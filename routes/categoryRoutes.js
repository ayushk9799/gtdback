import { Router } from "express";
import Category from "../models/Category.js";
import Case from "../models/Case.js";

const router = Router();

// POST /api/categories -> create new medicine categories
// Accepts either a single 'name' (string) with optional 'taxonomy'|'taxonomyCode'
// or 'names' (array of strings or objects: { name, taxonomy | taxonomyCode })
router.post("/", async (req, res, next) => {
    try {
      const { name, names } = req.body;
  
      // Helper to normalize category names only
      const normalizeName = (str) =>
        typeof str === "string" ? str.trim().toLowerCase() : undefined;
  
      // -----------------------
      // Bulk mode
      // -----------------------
      if (Array.isArray(names)) {
        const items = names
          .map((item) => {
            if (typeof item === "string") return { name: normalizeName(item) };
            if (item && typeof item === "object") {
              return {
                name: normalizeName(item.name),
                taxonomy: item.taxonomy || item.taxonomyCode,
              };
            }
            return null;
          })
          .filter((i) => i && i.name);
  
        if (items.length === 0) {
          return res.status(400).json({ error: "'names' must contain at least one valid item" });
        }
  
        // Deduplicate by name
        const unique = Array.from(new Map(items.map((i) => [i.name, i])).values());
        const namesOnly = unique.map((i) => i.name);
  
        // Find existing categories by name
        const existingNames = new Set(
          (await Category.find({ name: { $in: namesOnly } }).select("name")).map((d) => d.name)
        );
  
        // Filter to new candidates
        const candidates = unique.filter((i) => !existingNames.has(i.name));
  
        // Check existing taxonomy codes (case-sensitive)
        const providedTaxonomies = [...new Set(candidates.map((c) => c.taxonomy).filter(Boolean))];
        const existingTax = new Set(
          (await Category.find({ taxonomy: { $in: providedTaxonomies } }).select("taxonomy"))
            .map((d) => d.taxonomy)
        );
  
        const toCreate = candidates.filter((c) => !c.taxonomy || !existingTax.has(c.taxonomy));
        const created = toCreate.length
          ? await Category.insertMany(toCreate.map((c) => ({ ...c, caseCount: 0, caseList: [] })))
          : [];
  
        return res.status(created.length ? 201 : 200).json({
          success: true,
          created,
          skippedExisting: [...existingNames],
          skippedTaxonomy: candidates.filter((c) => c.taxonomy && existingTax.has(c.taxonomy)).map((c) => c.name),
          requested: namesOnly,
        });
      }
  
      // -----------------------
      // Single mode
      // -----------------------
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "'name' is required" });
      }
  
      const normalizedName = normalizeName(name);
      const taxonomy = req.body.taxonomy || req.body.taxonomyCode;
  
      if (await Category.findOne({ name: normalizedName })) {
        return res.status(409).json({ error: "Category already exists" });
      }
  
      if (taxonomy && await Category.findOne({ taxonomy })) {
        return res.status(409).json({ error: "Taxonomy already exists" });
      }
  
      const category = await Category.create({
        name: normalizedName,
        taxonomy,
        caseCount: 0,
        caseList: [],
      });
  
      return res.status(201).json({ success: true, category });
    } catch (err) {
      next(err);
    }
  });
  
  

// GET /api/categories -> list all categories
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find().select("name taxonomy caseCount");
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

export default router;


// POST /api/categories/:categoryId/cases -> add an existing case to a category
router.post("/:categoryId/cases", async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: "'caseId' is required" });
    }

    const exists = await Case.exists({ _id: caseId });
    if (!exists) {
      return res.status(404).json({ error: "Case not found" });
    }

    const updated = await Category.addCaseToCategory(categoryId, caseId);
    res.status(200).json({ success: true, category: updated });
  } catch (err) {
    next(err);
  }
});

