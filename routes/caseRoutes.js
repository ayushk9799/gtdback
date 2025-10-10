import { Router } from "express";
import Case from "../models/Case.js";
import Category from "../models/Category.js";
import mongoose from "mongoose";

const router = Router();

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

export default router;


