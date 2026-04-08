#!/usr/bin/env node
/**
 * Case Translation CLI Tool
 * 
 * Usage:
 *   node translate_cases.js --lang=de --count=5
 *   node translate_cases.js --lang=fr --count=10
 *   node translate_cases.js --lang=de --count=all
 *   node translate_cases.js --lang=de --dry-run
 * 
 * Options:
 *   --lang    Target language code (required). e.g. de, fr, es, pt, it, zh, ja, ko, ar, hi
 *   --count   Number of cases to translate (default: 5, or "all")
 *   --dry-run Show what would be translated without actually doing it
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: './config/config.env' });

// ─── Config ──────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY1;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
const API_BASE = 'http://localhost:3002';
const RETRY_COUNT = 2;
const DELAY_MS = 1000;

// ─── Language display names ────────────────────────────────────────────────
const LANG_NAMES = {
  de: 'German (Deutsch)', fr: 'French (Français)', es: 'Spanish (Español)',
  pt: 'Portuguese (Português)', it: 'Italian (Italiano)', zh: 'Chinese (中文)',
  ja: 'Japanese (日本語)', ko: 'Korean (한국어)', ar: 'Arabic (العربية)',
  hi: 'Hindi (हिन्दी)', tr: 'Turkish (Türkçe)', ru: 'Russian (Русский)',
  nl: 'Dutch (Nederlands)', pl: 'Polish (Polski)', sv: 'Swedish (Svenska)',
};

// ─── Parse CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      parsed[key] = rest.join('=') || true;
    }
  }
  return parsed;
}

// ─── Call Gemini ─────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "minimal" }
    }
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }
  
  // Strip out any surrounding non-json garbage that might cause parsing errors
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return JSON.parse(cleaned);
}

// ─── String Extraction Engine ───────────────────────────────────────────────
function shouldSkipKey(key) {
  const lKey = key.toLowerCase();
  const ignored = [
    'id', '_id', 'caseid', 'diagnosisid', 'treatmentid', 'testid', 
    'type', 'url', 'imageurl', 'video', 'iscorrect', 'priority', 
    'dosage', 'referencerange', 'unit', 'createdat', 'updatedat', 
    'version', '__v', 'stepnumber'
  ];
  if (ignored.includes(lKey) || lKey.endsWith('id')) return true;
  return false;
}

function shouldSkipValue(val) {
  // Skip pure numbers, units, URLs, etc.
  if (/^[\d.,\s]+$/.test(val)) return true;
  if (/^https?:\/\//.test(val)) return true;
  return false;
}

function extractStrings(obj, path = '') {
  let strings = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const val = obj[key].trim();
      if (!shouldSkipKey(key) && val.length > 0 && !shouldSkipValue(val)) {
        strings[`${path}${key}`] = obj[key];
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      const nested = extractStrings(obj[key], `${path}${key}.`);
      strings = { ...strings, ...nested };
    }
  }
  return strings;
}

function applyStrings(obj, translatedStrings, path = '') {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const fullPath = `${path}${key}`;
      if (translatedStrings[fullPath] !== undefined) {
        result[key] = translatedStrings[fullPath];
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = applyStrings(obj[key], translatedStrings, `${path}${key}.`);
    }
  }
  return result;
}

// ─── Generic Step Translator ────────────────────────────────────────────────


function buildTranslatePrompt(langName, chunk) {
  return `You are a native ${langName}-speaking medical professional. Translate ALL values in this JSON from English to ${langName}.

CRITICAL RULES:
1. You MUST translate EVERY single key-value pair. Do NOT skip any.
2. Write naturally as a native ${langName} speaker would in a clinical setting.
3. Use standard ${langName} medical terminology (e.g. use the ${langName} names for conditions, symptoms, body parts).
4. Keep drug names (Aspirin, Metformin, Clopidogrel), dosages (325mg), units (mmHg, bpm, ng/mL), numerical lab values, and reference ranges UNCHANGED.
5. Use the locally accepted ${langName} medical abbreviations (e.g. translate ECG, MRI, CBC to their ${langName} equivalents if they differ).
6. Preserve markdown formatting like **bold** markers.
7. Return the EXACT same keys. Do NOT rename, add, or remove any keys.
8. Return ONLY valid JSON, nothing else.

Total keys: ${Object.keys(chunk).length}

${JSON.stringify(chunk, null, 2)}`;
}

async function translateStepData(stepData, lang) {
  if (!stepData) return stepData;
  const langName = LANG_NAMES[lang] || lang;
  
  // 1. Extract only strings
  const flatStrings = extractStrings(stepData);
  const allKeys = Object.keys(flatStrings);
  if (allKeys.length === 0) return stepData;

  // 2. Group keys by top-level section for smart chunking
  //    e.g. "howWeLandedOnTheDiagnosis.0" → group "howWeLandedOnTheDiagnosis"
  //    Simple steps with few keys go as one chunk
  const groups = {};
  for (const key of allKeys) {
    const topLevel = key.split('.')[0];
    if (!groups[topLevel]) groups[topLevel] = {};
    groups[topLevel][key] = flatStrings[key];
  }

  const chunks = Object.values(groups);
  // If only 1-2 groups, send as single chunk
  if (chunks.length <= 2) {
    chunks.length = 0;
    chunks.push(flatStrings);
  }

  // 3. Translate each chunk with per-chunk retry
  let translatedFlatStrings = {};

  for (let ci = 0; ci < chunks.length; ci++) {
    let chunkResult = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const prompt = buildTranslatePrompt(langName, chunks[ci]);
        chunkResult = await callGemini(prompt);
        break;
      } catch (err) {
        if (attempt < 2) {
          process.stdout.write('↻');
          await delay(1500);
        } else {
          throw err;
        }
      }
    }
    translatedFlatStrings = { ...translatedFlatStrings, ...chunkResult };
    if (ci < chunks.length - 1) await delay(500);
  }

  // 4. Retry any missing keys (single pass)
  const missingKeys = allKeys.filter(k => !translatedFlatStrings[k]);
  if (missingKeys.length > 0) {
    const retryChunk = {};
    for (const k of missingKeys) retryChunk[k] = flatStrings[k];
    process.stdout.write(`⟲${missingKeys.length}`);
    await delay(1000);
    const retryResult = await callGemini(buildTranslatePrompt(langName, retryChunk));
    translatedFlatStrings = { ...translatedFlatStrings, ...retryResult };
  }
  
  // 5. Re-apply translated strings to original object
  return applyStrings(stepData, translatedFlatStrings);
}

// ─── Translate a single step with retries ───────────────────────────────────
async function translateStepWithRetry(translator, stepData, lang, stepLabel) {
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      const result = await translator(stepData, lang);
      process.stdout.write('✓');
      return result;
    } catch (err) {
      if (attempt < RETRY_COUNT) {
        process.stdout.write('↻');
        await delay(1500);
      } else {
        process.stdout.write('✗');
        throw err;
      }
    }
  }
}

// ─── Translate a full case ──────────────────────────────────────────────────
async function translateCase(caseItem, lang) {
  const langName = LANG_NAMES[lang] || lang;
  const cd = caseItem.caseData;
  const steps = cd.steps || [];
  const translatedSteps = [];

  // Extract patient gender for accurate title translation
  const step1Data = steps[0]?.data;
  const patientGender = step1Data?.basicInfo?.gender || 'Unknown';
  const patientAge = step1Data?.basicInfo?.age || '';

  // Translate caseTitle and stepTitles
  process.stdout.write(' [titles:');
  const titlePrompt = `You are a native ${langName} speaker. Translate these medical case titles to ${langName}.

IMPORTANT CONTEXT: The patient is a ${patientAge}-year-old ${patientGender}. Use the CORRECT grammatical gender in ${langName}.

Translate naturally as a native speaker would write it. Output ONLY valid JSON.
{
  "caseTitle": ${JSON.stringify(cd.caseTitle)},
  "stepTitles": ${JSON.stringify(steps.map(s => s.stepTitle))}
}`;
  let titles;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      titles = await callGemini(titlePrompt);
      process.stdout.write('✓]');
      break;
    } catch (err) {
      if (attempt < RETRY_COUNT) {
        process.stdout.write('↻');
        await delay(1500);
      } else {
        throw err;
      }
    }
  }
  await delay(DELAY_MS);

  // Translate each step's data independently with per-step retries
  const stepNames = ['S1', 'S2', 'S3', 'S4', 'S5'];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepLabel = stepNames[i] || `S${i + 1}`;
    process.stdout.write(` [${stepLabel}:`);

    if (!step?.data) {
      process.stdout.write('skip]');
      translatedSteps.push(null);
      continue;
    }

    const translatedData = await translateStepWithRetry(translateStepData, step.data, lang, stepLabel);
    process.stdout.write(']');
    translatedSteps.push({
      stepTitle: titles.stepTitles?.[i] || step.stepTitle,
      data: translatedData
    });
    await delay(DELAY_MS);
  }

  // Build translation overlay
  const translation = {
    caseTitle: titles.caseTitle || cd.caseTitle,
    steps: steps.map((step, i) => {
      if (!translatedSteps[i]) return step;
      return {
        ...step,
        stepTitle: translatedSteps[i].stepTitle,
        data: translatedSteps[i].data
      };
    })
  };

  return translation;
}

// ─── Upload translation ────────────────────────────────────────────────────
async function uploadTranslation(caseId, lang, translation) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/translations/${lang}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(translation)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text.substring(0, 200)}`);
  }
  return res.json();
}

// ─── Fetch all cases and filter untranslated ─────────────────────────────────
async function fetchUntranslatedCases(lang, maxCount) {
  process.stdout.write('📡 Fetching case IDs');

  // Get all case IDs
  const idsRes = await fetch(`${API_BASE}/api/cases/ids`);
  const idsData = await idsRes.json();
  const allCaseIds = idsData.caseIds;
  process.stdout.write(` (${allCaseIds.length} total)`);

  // Fetch each case and check for translation
  const untranslated = [];
  for (const caseId of allCaseIds) {
    const res = await fetch(`${API_BASE}/api/cases/casewise/${caseId}`);
    const data = await res.json();
    const caseItem = data.caseItem;

    if (!caseItem.translations?.[lang]) {
      untranslated.push(caseItem);
      if (maxCount !== 'all' && untranslated.length >= maxCount) break;
    }
    process.stdout.write('.');
  }

  console.log(' done');
  return untranslated;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.lang) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║              🏥 Case Translation CLI Tool                  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Usage:                                                    ║
║    node translate_cases.js --lang=de --count=5             ║
║    node translate_cases.js --lang=fr --count=20            ║
║    node translate_cases.js --lang=de --count=all           ║
║                                                            ║
║  Languages: de, fr, es, pt, it, zh, ja, ko, ar, hi,       ║
║             tr, ru, nl, pl, sv                             ║
║                                                            ║
║  Options:                                                  ║
║    --lang      Language code (required)                    ║
║    --count     Number of cases (default: 5)                ║
║    --dry-run   Preview without translating                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const lang = args.lang;
  const count = args.count === 'all' ? 'all' : parseInt(args.count || '5', 10);
  const dryRun = !!args['dry-run'];
  const langName = LANG_NAMES[lang] || lang;

  console.log(`\n🏥 Case Translation Tool`);
  console.log(`   Language: ${langName} (${lang})`);
  console.log(`   Count:    ${count === 'all' ? 'ALL untranslated' : count}`);
  if (dryRun) console.log(`   Mode:     DRY RUN (no changes)`);
  console.log('');

  const cases = await fetchUntranslatedCases(lang, count);

  if (cases.length === 0) {
    console.log(`\n✅ All cases already have ${langName} translations!`);
    return;
  }

  console.log(`\n📋 Found ${cases.length} cases to translate:\n`);
  cases.forEach((c, i) => {
    const title = c.caseData?.caseTitle || c.caseData?.caseId || 'Unknown';
    const cat = c.caseData?.caseCategory || 'N/A';
    console.log(`   ${String(i + 1).padStart(3)}. ${title} (${cat})`);
  });

  if (dryRun) {
    console.log(`\n🏁 Dry run complete. Run without --dry-run to translate.`);
    return;
  }

  console.log(`\n🚀 Starting translation (each case has ~5 steps, this takes ~30s per case)...\n`);
  const startTime = Date.now();

  let successCount = 0;
  const errors = [];

  for (let i = 0; i < cases.length; i++) {
    const caseItem = cases[i];
    const caseId = caseItem.caseData?.caseId || 'unknown';
    const title = caseItem.caseData?.caseTitle || caseId;
    const progress = `[${String(i + 1).padStart(String(cases.length).length)}/${cases.length}]`;

    console.log(`${progress} ${title}`);

    try {
      process.stdout.write(`      `);
      const translation = await translateCase(caseItem, lang);
      console.log('');

      // Upload
      await uploadTranslation(caseItem._id, lang, translation);
      console.log(`       ✅ Done`);
      successCount++;
    } catch (err) {
      console.log(`\n       ❌ Failed: ${err.message.substring(0, 80)}`);
      errors.push({ caseId, title, error: err.message });
    }

    if (i < cases.length - 1) await delay(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    📊 SUMMARY                              ║
╠════════════════════════════════════════════════════════════╣
║  Language:   ${langName.padEnd(43)} ║
║  Translated: ${String(successCount).padEnd(43)} ║
║  Failed:     ${String(errors.length).padEnd(43)} ║
║  Time:       ${(elapsed + 's').padEnd(43)} ║
╚════════════════════════════════════════════════════════════╝`);

  if (errors.length > 0) {
    console.log('\n❌ Failed cases:');
    errors.forEach(e => console.log(`   • ${e.title}: ${e.error.substring(0, 80)}`));
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
