import Gameplay from "../models/Gameplay.js";
import Case from "../models/Case.js";
import User from "../models/User.js";

function computeTotals(points) {
  const { diagnosis = 0, tests = 0, treatment = 0, penalties = 0 } = points || {};
  const total = (diagnosis || 0) + (tests || 0) + (treatment || 0) - (penalties || 0);
  return { ...points, total };
}

// POST /api/gameplays -> start or get existing gameplay
export const startOrGetGameplay = async (req, res, next) => {
  try {
    const { userId, caseId } = req.body || {};

    if (!userId || !caseId) {
      return res.status(400).json({ error: "userId and caseId are required" });
    }

    const [userExists, caseExists] = await Promise.all([
      User.exists({ _id: userId }),
      Case.exists({ _id: caseId }),
    ]);

    if (!userExists) return res.status(404).json({ error: "User not found" });
    if (!caseExists) return res.status(404).json({ error: "Case not found" });

    let gameplay = await Gameplay.findOne({ userId, caseId });
    if (!gameplay) {
      gameplay = await Gameplay.create({ userId, caseId });
    }

    return res.status(201).json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// GET /api/gameplays/:id
export const getGameplay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const gameplay = await Gameplay.findById(id).populate("userId", "name email").populate("caseId");
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });
    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// GET /api/gameplays?userId=&caseId=
export const listGameplays = async (req, res, next) => {
  try {
    const { userId, caseId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (caseId) filter.caseId = caseId;
    const items = await Gameplay.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, gameplays: items });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/gameplays/:id/diagnosis
export const setDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { diagnosisIndex, pointsDelta } = req.body || {};
    if (typeof diagnosisIndex !== "number") {
      return res.status(400).json({ error: "diagnosisIndex (number) is required" });
    }

    const gameplay = await Gameplay.findById(id);
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });

    gameplay.selections.diagnosisIndex = diagnosisIndex;
    if (typeof pointsDelta === "number") {
      gameplay.points.diagnosis = (gameplay.points.diagnosis || 0) + pointsDelta;
    }
    gameplay.points = computeTotals(gameplay.points);
    gameplay.history.push({ type: "diagnosis", index: diagnosisIndex, deltaPoints: pointsDelta || 0 });
    await gameplay.save();

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/gameplays/:id/tests
export const addTestSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { testIndex, pointsDelta } = req.body || {};
    if (typeof testIndex !== "number") {
      return res.status(400).json({ error: "testIndex (number) is required" });
    }

    const gameplay = await Gameplay.findById(id);
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });

    gameplay.selections.testIndices.push(testIndex);
    if (typeof pointsDelta === "number") {
      gameplay.points.tests = (gameplay.points.tests || 0) + pointsDelta;
    }
    gameplay.points = computeTotals(gameplay.points);
    gameplay.history.push({ type: "test", index: testIndex, deltaPoints: pointsDelta || 0 });
    await gameplay.save();

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/gameplays/:id/treatment
export const addTreatmentSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { treatmentIndex, pointsDelta } = req.body || {};
    if (typeof treatmentIndex !== "number") {
      return res.status(400).json({ error: "treatmentIndex (number) is required" });
    }

    const gameplay = await Gameplay.findById(id);
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });

    gameplay.selections.treatmentIndices.push(treatmentIndex);
    if (typeof pointsDelta === "number") {
      gameplay.points.treatment = (gameplay.points.treatment || 0) + pointsDelta;
    }
    gameplay.points = computeTotals(gameplay.points);
    gameplay.history.push({ type: "treatment", index: treatmentIndex, deltaPoints: pointsDelta || 0 });
    await gameplay.save();

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// POST /api/gameplays/:id/complete
export const completeGameplay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { penaltiesDelta } = req.body || {};
    const gameplay = await Gameplay.findById(id);
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });

    if (typeof penaltiesDelta === "number") {
      gameplay.points.penalties = (gameplay.points.penalties || 0) + penaltiesDelta;
    }
    gameplay.points = computeTotals(gameplay.points);
    gameplay.status = "completed";
    gameplay.completedAt = new Date();
    await gameplay.save();

    // Upsert into User.completedCases for quick lookup
    try {
      await User.updateOne(
        { _id: gameplay.userId },
        {
          $addToSet: {
            completedCases: { case: gameplay.caseId, gameplay: gameplay._id },
          },
        }
      );
    } catch (_) {}

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/gameplays/:id/reset
export const resetGameplay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const gameplay = await Gameplay.findById(id);
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });

    gameplay.selections = { diagnosisIndex: null, testIndices: [], treatmentIndices: [] };
    gameplay.points = { total: 0, diagnosis: 0, tests: 0, treatment: 0, penalties: 0 };
    gameplay.history = [];
    gameplay.status = "in_progress";
    gameplay.startedAt = new Date();
    gameplay.completedAt = undefined;
    await gameplay.save();

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// POST /api/gameplays/:id/submit
// Bulk submission of selections and optional completion in a single call
export const submitSelections = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, caseId, diagnosisIndex, testIndices, treatmentIndices, penaltiesDelta, complete } = req.body || {};

    let gameplay = null;

    // If an id is provided, attempt to load it
    if (id) {
      gameplay = await Gameplay.findById(id);
      if (!gameplay && (!userId || !caseId)) {
        return res.status(404).json({ error: "Gameplay not found. Provide userId and caseId to create one." });
      }
    }

    // If no gameplay loaded, ensure userId and caseId are present and upsert
    if (!gameplay) {
      if (!userId || !caseId) {
        return res.status(400).json({ error: "userId and caseId are required when gameplay id is not found or not provided" });
      }

      // Validate references exist
      const [userExists, caseExists] = await Promise.all([
        User.exists({ _id: userId }),
        Case.exists({ _id: caseId }),
      ]);
      if (!userExists) return res.status(404).json({ error: "User not found" });
      if (!caseExists) return res.status(404).json({ error: "Case not found" });

      gameplay = await Gameplay.findOne({ userId, caseId });
      if (!gameplay) {
        gameplay = await Gameplay.create({ userId, caseId });
      }
    }

    // Diagnosis
    if (typeof diagnosisIndex === "number" && Number.isFinite(diagnosisIndex)) {
      gameplay.selections.diagnosisIndex = diagnosisIndex;
      gameplay.history.push({ type: "diagnosis", index: diagnosisIndex, deltaPoints: 0 });
    }

    // Tests (dedupe)
    if (Array.isArray(testIndices)) {
      for (const idx of testIndices) {
        if (typeof idx === "number" && Number.isFinite(idx)) {
          if (!gameplay.selections.testIndices.includes(idx)) {
            gameplay.selections.testIndices.push(idx);
          }
          gameplay.history.push({ type: "test", index: idx, deltaPoints: 0 });
        }
      }
    }

    // Treatments (dedupe)
    if (Array.isArray(treatmentIndices)) {
      for (const idx of treatmentIndices) {
        if (typeof idx === "number" && Number.isFinite(idx)) {
          if (!gameplay.selections.treatmentIndices.includes(idx)) {
            gameplay.selections.treatmentIndices.push(idx);
          }
          gameplay.history.push({ type: "treatment", index: idx, deltaPoints: 0 });
        }
      }
    }

    // Optional penalties
    if (typeof penaltiesDelta === "number") {
      gameplay.points.penalties = (gameplay.points.penalties || 0) + penaltiesDelta;
      gameplay.history.push({ type: "penalty", deltaPoints: penaltiesDelta });
    }

    gameplay.points = computeTotals(gameplay.points);

    // Optionally complete
    if (complete) {
      gameplay.status = "completed";
      gameplay.completedAt = new Date();
    }

    await gameplay.save();

    if (complete) {
      try {
        await User.updateOne(
          { _id: gameplay.userId },
          { $addToSet: { completedCases: { case: gameplay.caseId, gameplay: gameplay._id } } }
        );
      } catch (_) {}
    }

    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};


