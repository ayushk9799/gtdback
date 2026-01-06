import { Router } from "express";
import Case from "../models/Case.js";
import Category from "../models/Category.js";
import mongoose from "mongoose";
// import { buildPublicUrl, presignPutForKey } from "../s3.js";

const router = Router();

// Helpers
const ALLOWED_PARTS = new Set(["basicspeech", "vitalsspeech", "historyspeech", "physicalspeech"]);
const buildKeyFor = (caseId, part) => `mp3files/${caseId}_${part}.mp3`;
const findByBusinessCaseId = async (caseId) => {
  if (typeof caseId !== "string" || !caseId.trim()) return null;
  return await Case.findOne({ "caseData.caseId": caseId });
};

// Extract minimal diagnosis info from a Case document
const extractDiagnosisSummary = (caseDoc) => {
  if (!caseDoc || !caseDoc.caseData) return null;
  const { caseCategory, steps } = caseDoc.caseData;

  let correctDiagnosis = null;

  if (Array.isArray(steps)) {
    for (const step of steps) {
      const data = step?.data;

      // Preferred: pull from Case Review -> coreClinicalInsight.correctDiagnosis
      if (data?.coreClinicalInsight?.correctDiagnosis && !correctDiagnosis) {
        correctDiagnosis = data.coreClinicalInsight.correctDiagnosis;
      }

      // Fallback: look through diagnosisOptions array for isCorrect === true
      if (!correctDiagnosis && Array.isArray(data?.diagnosisOptions)) {
        const correct = data.diagnosisOptions.find((d) => d?.isCorrect === true);
        if (correct) {
          correctDiagnosis = correct.diagnosisName;
        }
      }
    }
  }

  if (!correctDiagnosis) return null;

  return {
    id: caseDoc._id,
    caseCategory: caseCategory || null,
    correctDiagnosis,
  };
};

// POST /api/cases/bulk -> upload array of cases
// Accepts either body as an array or { cases: [...] }
router.post("/bulk", async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.cases;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: "Provide an array of cases in request body or in 'cases'" });
    }

    // Normalize category names (lowercase) and gather unique category names
    const nameSet = new Set();
    for (const item of payload) {
      if (item && typeof item.caseCategory === "string" && item.caseCategory.trim()) {
        nameSet.add(item.caseCategory.trim().toLowerCase());
      }
    }

    // Load existing categories by name
    const categoryNames = [...nameSet];
    const existingCategories = categoryNames.length
      ? await Category.find({ name: { $in: categoryNames } })
      : [];
    const nameToCategory = new Map(existingCategories.map((c) => [c.name, c]));

    // Create missing categories in bulk
    const missingNames = categoryNames.filter((n) => !nameToCategory.has(n));
    let createdCategories = [];
    if (missingNames.length > 0) {
      const docs = missingNames.map((n) => ({ name: n, caseCount: 0, caseList: [] }));
      createdCategories = await Category.insertMany(docs);
      for (const c of createdCategories) {
        nameToCategory.set(c.name, c);
      }
    }

    let createdCases = 0;
    let updatedCases = 0;
    let linkOps = 0;
    const results = [];

    for (const item of payload) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const categoryName = typeof item.caseCategory === "string" ? item.caseCategory.trim().toLowerCase() : undefined;
      const categoryDoc = categoryName ? nameToCategory.get(categoryName) : undefined;

      // Deduplicate by business id if present at item.caseId; otherwise by deep equality is not feasible
      let caseDoc = undefined;
      if (typeof item.caseId === "string" && item.caseId.trim()) {
        caseDoc = await Case.findOne({ "caseData.caseId": item.caseId });
      }

      if (caseDoc) {
        // Update existing case data
        caseDoc.caseData = item;
        await caseDoc.save();
        updatedCases += 1;
      } else {
        // Create new case
        caseDoc = await Case.create({ caseData: item });
        createdCases += 1;
      }

      if (categoryDoc) {
        // Link case to category (idempotent via model helper)
        await Category.addCaseToCategory(categoryDoc._id, caseDoc._id);
        linkOps += 1;
      }

      results.push({ caseId: item.caseId, category: categoryName, id: caseDoc._id });
    }

    return res.status(createdCases > 0 ? 201 : 200).json({
      success: true,
      summary: {
        createdCategories: createdCategories.length,
        createdCases,
        updatedCases,
        linked: linkOps,
      },
      results,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cases/ids -> list all business caseIds
router.get("/ids", async (req, res, next) => {
  try {
    const docs = await Case.find({}, { "caseData.caseId": 1, _id: 0 });
    const caseIds = docs
      .map((doc) => doc.caseData?.caseId)
      .filter((id) => id != null);
    return res.json({ success: true, caseIds });
  } catch (err) {
    next(err);
  }
});

// GET /api/cases/diagnoses -> list correct diagnoses for all cases
// Optional query: ?caseId=NEU005 to filter by business caseId
router.get("/diagnoses", async (req, res, next) => {
  try {
    const { caseId } = req.query || {};

    let query = {};
    if (typeof caseId === "string" && caseId.trim()) {
      query = { "caseData.caseId": caseId.trim() };
    }

    const docs = await Case.find(query);
    if (!docs || docs.length === 0) {
      return res.json({ success: true, diagnoses: [] });
    }

    const diagnoses = [];
    for (const doc of docs) {
      const summary = extractDiagnosisSummary(doc);
      if (summary) {
        diagnoses.push(summary);
      }
    }

    return res.json({ success: true, diagnoses });
  } catch (err) {
    next(err);
  }
});
router.get("/casewise/:caseId", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const doc = await Case.findOne({ "caseData.caseId": caseId });
    if (!doc) return res.status(404).json({ error: "Case not found" });
    return res.json({ success: true, caseItem: doc });
  }
  catch (err) {
    next(err);
  }
});

// PATCH /api/cases/merge -> partially update fields inside caseData by business caseId
// Body: { caseId: string, updates: object }
router.patch("/merge", async (req, res, next) => {
  try {
    const { caseId, updates } = req.body || {};
    if (typeof caseId !== "string" || !caseId.trim()) {
      return res.status(400).json({ error: "'caseId' (string) is required" });
    }
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      return res.status(400).json({ error: "'updates' (object) is required" });
    }

    // Prevent accidental overwrite of business identifier unless explicitly intended
    if (Object.prototype.hasOwnProperty.call(updates, "caseId") && updates.caseId !== caseId) {
      return res.status(400).json({ error: "Updating 'caseId' is not allowed in this endpoint" });
    }

    // Flatten nested object to dot paths for $set
    const flattenObject = (obj, parent = "") => {
      const entries = {};
      for (const [key, value] of Object.entries(obj)) {
        const path = parent ? `${parent}.${key}` : key;
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          Object.assign(entries, flattenObject(value, path));
        } else {
          entries[path] = value;
        }
      }
      return entries;
    };

    const flat = flattenObject(updates);
    const setDoc = {};
    for (const [k, v] of Object.entries(flat)) {
      setDoc[`caseData.${k}`] = v;
    }

    // Try to update existing by business id
    const updated = await Case.findOneAndUpdate(
      { "caseData.caseId": caseId },
      { $set: setDoc },
      { new: true }
    );

    if (updated) {
      return res.json({ success: true, created: false, case: updated });
    }

    // If not found, create new with merged payload
    const newDoc = await Case.create({
      caseData: { caseId, ...updates },
    });
    return res.status(201).json({ success: true, created: true, case: newDoc });
  } catch (err) {
    next(err);
  }
});

router.patch("/update-mainimage", async (req, res, next) => {
  try {
    const { caseIds } = req.body || {};

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({ error: "Provide an array of caseIds in request body" });
    }

    const S3_BASE_URL = "https://gtdthousandways1.s3.ap-south-1.amazonaws.com";
    const results = [];

    for (const caseId of caseIds) {
      const mainimage = `${S3_BASE_URL}/${caseId}.jpeg`;

      const updated = await Case.findOneAndUpdate(
        { "caseData.caseId": caseId },
        { $set: { "caseData.mainimage": mainimage } },
        { new: true }
      );

      if (updated) {
        results.push({ caseId, mainimage, success: true });
      } else {
        results.push({ caseId, success: false, error: "Case not found" });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return res.json({
      success: true,
      summary: {
        total: caseIds.length,
        updated: successCount,
        failed: caseIds.length - successCount
      },
      results
    });
  } catch (err) {
    next(err);
  }
});
// POST /api/cases/:caseId/mp3/presign -> presign S3 PUT for one part
router.post("/:caseId/mp3/presign", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { part } = req.body || {};
    if (!ALLOWED_PARTS.has(part)) {
      return res.status(400).json({ error: "'part' must be one of basicspeech, vitalsspeech, historyspeech, physicalspeech" });
    }
    const caseDoc = await findByBusinessCaseId(caseId);
    if (!caseDoc) {
      return res.status(404).json({ error: "Case not found by caseId" });
    }
    const key = buildKeyFor(caseId, part);
    const uploadUrl = await presignPutForKey(key, "audio/mpeg", 900);
    const url = buildPublicUrl(key);
    return res.json({ success: true, uploadUrl, key, url });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cases/:caseId/mp3 -> save full URL for a part (computed server-side)
router.patch("/:caseId/mp3", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { part } = req.body || {};
    if (!ALLOWED_PARTS.has(part)) {
      return res.status(400).json({ error: "'part' must be one of basicspeech, vitalsspeech, historyspeech, physicalspeech" });
    }
    const caseDoc = await findByBusinessCaseId(caseId);
    if (!caseDoc) {
      return res.status(404).json({ error: "Case not found by caseId" });
    }
    const key = buildKeyFor(caseId, part);
    const url = buildPublicUrl(key);
    if (!caseDoc.mp3) {
      caseDoc.mp3 = {};
    }
    caseDoc.mp3[part] = url;
    await caseDoc.save();
    return res.json({ success: true, caseId, mp3: caseDoc.mp3 });
  } catch (err) {
    next(err);
  }
});

// GET /api/cases/:caseId/mp3 -> fetch stored URLs for a case
router.get("/:caseId/mp3", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const caseDoc = await findByBusinessCaseId(caseId);
    if (!caseDoc) {
      return res.status(404).json({ error: "Case not found by caseId" });
    }
    const mp3 = caseDoc.mp3 || {
      basicspeech: null,
      vitalsspeech: null,
      historyspeech: null,
      physicalspeech: null,
    };
    return res.json({ success: true, caseId, mp3 });
  } catch (err) {
    next(err);
  }
});
router.get("/withoutimage", async (req, res, next) => {
  try {
    const docs = await Case.find({

      "caseData.mainimage": { $exists: false }

    });

    const caseIds = docs.map((doc) => doc.caseData?.caseId).filter(Boolean);

    return res.json({
      success: true,
      count: caseIds.length,
      caseIds
    });
  } catch (err) {
    next(err);
  }
});
router.get("/summaries", async (req, res, next) => {
  try {
    const { caseIds } = req.body || {};

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({ error: "Provide an array of caseIds in request body" });
    }

    // Find all cases matching the provided caseIds
    const docs = await Case.find({ "caseData.caseId": { $in: caseIds } });

    // Extract simplified summary from each case
    const summaries = docs.map((doc) => {
      const data = doc.caseData || {};
      const firstStep = Array.isArray(data.steps) && data.steps[0]?.data;
      const basicInfo = firstStep?.basicInfo || {};

      return {
        caseId: data.caseId || null,
        caseTitle: data.caseTitle || null,
        name: basicInfo.name || null,
        age: basicInfo.age || null,
        gender: basicInfo.gender || null,
        chiefComplaint: firstStep?.chiefComplaint || null,
      };
    });

    return res.json(summaries);
  } catch (err) {
    next(err);
  }
});


// GET /api/cases/:id -> fetch a single case by ObjectId
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Valid case ObjectId required" });
    }
    const doc = await Case.findById(id);
    if (!doc) return res.status(404).json({ error: "Case not found" });
    return res.json({ success: true, case: doc });
  } catch (err) {
    next(err);
  }
});
// POST /api/cases/summaries -> fetch simplified patient summaries for given caseIds
// Body: { caseIds: ["DAILY001", "NEU005", ...] }


// PATCH /api/cases/update-mainimage -> bulk update mainimage for given caseIds
// Body: { caseIds: ["RHE003", "NEU005", ...] }


// GET /api/cases/without-image -> fetch cases where mainImage doesn't exist


export default router;


