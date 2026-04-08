#!/usr/bin/env node
/**
 * Quiz Translation CLI Tool
 * 
 * Usage:
 *   node translate_quizzes.js --lang=de --count=10
 *   node translate_quizzes.js --lang=fr --count=50
 *   node translate_quizzes.js --lang=de               # defaults to 10
 *   node translate_quizzes.js --lang=de --count=all    # translate ALL untranslated
 * 
 * Options:
 *   --lang    Target language code (required). e.g. de, fr, es, pt, it, zh, ja, ko, ar, hi
 *   --count   Number of quizzes to translate (default: 10, or "all")
 *   --dry-run Show what would be translated without actually doing it
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: './config/config.env' });

// ─── Config ──────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
const API_BASE = 'http://localhost:3002';
const BATCH_SIZE = 50;       // Fetch this many quizzes per page from API
const RETRY_COUNT = 2;       // Retry failed translations this many times
const DELAY_MS = 500;        // Delay between Gemini calls (rate limiting)

// ─── Language display names ────────────────────────────────────────────────
const LANG_NAMES = {
  de: 'German (Deutsch)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  zh: 'Chinese (中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  ar: 'Arabic (العربية)',
  hi: 'Hindi (हिन्दी)',
  tr: 'Turkish (Türkçe)',
  ru: 'Russian (Русский)',
  nl: 'Dutch (Nederlands)',
  pl: 'Polish (Polski)',
  sv: 'Swedish (Svenska)',
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

// ─── Fetch all untranslated quizzes for a given language ──────────────────────
async function fetchUntranslatedQuizzes(lang, maxCount) {
  let allUntranslated = [];
  let page = 1;
  let hasMore = true;

  process.stdout.write('📡 Fetching quizzes from database');

  while (hasMore) {
    const res = await fetch(`${API_BASE}/api/quizz?page=${page}&limit=${BATCH_SIZE}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    const untranslated = data.data.filter(q => !q.translations?.[lang]);
    allUntranslated.push(...untranslated);
    process.stdout.write('.');

    hasMore = data.hasMore;
    page++;

    // If we have enough, stop fetching
    if (maxCount !== 'all' && allUntranslated.length >= maxCount) {
      allUntranslated = allUntranslated.slice(0, maxCount);
      break;
    }
  }

  console.log(' done');
  return allUntranslated;
}

// ─── Translate a single quiz using Gemini ────────────────────────────────────
async function translateQuiz(quiz, lang) {
  const langName = LANG_NAMES[lang] || lang;

  const prompt = `You are a professional medical translator. Translate this medical quiz from English to ${langName}.

RULES:
1. Keep medical terminology precise using standard ${langName} medical terms
2. Keep proper nouns, eponymous signs (e.g. "Phalen test", "Lachman Test"), and brand names in their original form
3. The option letter prefixes A), B), C), D) must remain exactly as in the original
4. Do NOT use line breaks inside JSON string values
5. Output ONLY valid JSON

English quiz:
- complain: ${JSON.stringify(quiz.complain)}
- options: ${JSON.stringify(quiz.options)}
- explain: ${JSON.stringify(quiz.explain)}

Return this exact JSON structure with ${langName} translations:
{"complain":"...","options":["...","...","...","..."],"explain":{"correct_answer":{"choice":"..."},"key_features":{"points":[{"label":"...","description":"..."}]},"incorrect_options":[{"choice":"...","explanation":"..."}]}}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
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

  return JSON.parse(cleaned);
}

// ─── Upload translation to backend ───────────────────────────────────────────
async function uploadTranslation(quizId, lang, translation) {
  const res = await fetch(`${API_BASE}/api/quizz/${quizId}/translations/${lang}`, {
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

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  // Validate arguments
  if (!args.lang) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║              🌐 Quiz Translation CLI Tool                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Usage:                                                    ║
║    node translate_quizzes.js --lang=de --count=10          ║
║    node translate_quizzes.js --lang=fr --count=100         ║
║    node translate_quizzes.js --lang=de --count=all         ║
║                                                            ║
║  Languages: de, fr, es, pt, it, zh, ja, ko, ar, hi,       ║
║             tr, ru, nl, pl, sv                             ║
║                                                            ║
║  Options:                                                  ║
║    --lang      Language code (required)                    ║
║    --count     Number of quizzes (default: 10)             ║
║    --dry-run   Preview without translating                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const lang = args.lang;
  const count = args.count === 'all' ? 'all' : parseInt(args.count || '10', 10);
  const dryRun = !!args['dry-run'];
  const langName = LANG_NAMES[lang] || lang;

  console.log(`\n🌐 Quiz Translation Tool`);
  console.log(`   Language: ${langName} (${lang})`);
  console.log(`   Count:    ${count === 'all' ? 'ALL untranslated' : count}`);
  if (dryRun) console.log(`   Mode:     DRY RUN (no changes)`);
  console.log('');

  // Fetch untranslated quizzes
  const quizzes = await fetchUntranslatedQuizzes(lang, count);

  if (quizzes.length === 0) {
    console.log(`\n✅ All quizzes already have ${langName} translations!`);
    return;
  }

  console.log(`\n📋 Found ${quizzes.length} quizzes to translate:\n`);
  quizzes.forEach((q, i) => {
    console.log(`   ${String(i + 1).padStart(3)}. ${q.case_title} (${q.department})`);
  });

  if (dryRun) {
    console.log(`\n🏁 Dry run complete. Run without --dry-run to translate.`);
    return;
  }

  // Translate and upload
  console.log(`\n🚀 Starting translation...\n`);
  const startTime = Date.now();

  let successCount = 0;
  const errors = [];

  for (let i = 0; i < quizzes.length; i++) {
    const quiz = quizzes[i];
    const progress = `[${String(i + 1).padStart(String(quizzes.length).length)}/${quizzes.length}]`;

    process.stdout.write(`${progress} ${quiz.case_title.substring(0, 50).padEnd(50)} `);

    let translation = null;
    let lastErr = null;

    // Try with retries
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        translation = await translateQuiz(quiz, lang);
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_COUNT) {
          process.stdout.write('↻ ');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!translation) {
      console.log('❌');
      errors.push({ id: quiz._id, title: quiz.case_title, error: lastErr.message });
      continue;
    }

    // Upload
    try {
      await uploadTranslation(quiz._id, lang, translation);
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log('❌ (upload)');
      errors.push({ id: quiz._id, title: quiz.case_title, error: err.message });
    }

    // Rate limiting delay
    if (i < quizzes.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
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
    console.log('\n❌ Failed quizzes:');
    errors.forEach(e => console.log(`   • ${e.title}: ${e.error.substring(0, 80)}`));
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
