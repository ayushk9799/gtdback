import Gameplay from "../models/Gameplay.js";
import Case from "../models/Case.js";
import DailyChallenge from "../models/DailyChallenge.js";
import User from "../models/User.js";
import TopUser from "../models/TopUser.js";
import DailyChallengeLeaderboard from "../models/DailyChallengeLeaderboard.js";

function computeTotals(points) {
  const { diagnosis = 0, tests = 0, treatment = 0, penalties = 0 } = points || {};
  const total = (diagnosis || 0) + (tests || 0) + (treatment || 0) - (penalties || 0);
  return { ...points, total };
}

async function updateLeaderboardForUser(userId) {
  // Fetch user score
  const user = await User.findById(userId).select("cumulativePoints.total inTop10").lean();
  if (!user) return;

  const newScore = user.cumulativePoints?.total || 0;

  // Update user's score in TopUser
  await TopUser.updateOne(
    { userId },
    { $set: { score: newScore } },
    { upsert: true }
  );

  // Get top 10 user IDs after the update
  const top10UserIds = await TopUser.find()
    .sort({ score: -1, _id: 1 })
    .limit(10)
    .select("userId")
    .lean()
    .then(docs => docs.map(d => d.userId));

  // Bulk update User.inTop10 flags in a single operation
  if (top10UserIds.length > 0) {
    await User.bulkWrite([
      {
        updateMany: {
          filter: { _id: { $in: top10UserIds }, inTop10: { $ne: true } },
          update: { $set: { inTop10: true } }
        }
      },
      {
        updateMany: {
          filter: { _id: { $nin: top10UserIds }, inTop10: true },
          update: { $set: { inTop10: false } }
        }
      }
    ]);
  }
}

// POST /api/gameplays -> start or get existing gameplay
export const startOrGetGameplay = async (req, res, next) => {
  try {
    const { userId, caseId, dailyChallengeId, sourceType } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Determine source type and validate
    const effectiveSourceType = sourceType || (dailyChallengeId ? "dailyChallenge" : "case");

    if (effectiveSourceType === "case") {
      if (!caseId) {
        return res.status(400).json({ error: "caseId is required for case gameplay" });
      }

      const [userExists, caseExists] = await Promise.all([
        User.exists({ _id: userId }),
        Case.exists({ _id: caseId }),
      ]);

      if (!userExists) return res.status(404).json({ error: "User not found" });
      if (!caseExists) return res.status(404).json({ error: "Case not found" });

      let gameplay = await Gameplay.findOne({ userId, caseId, sourceType: "case" });
      if (!gameplay) {
        gameplay = await Gameplay.create({ userId, caseId, sourceType: "case" });
      }

      return res.status(201).json({ success: true, gameplay });
    } else if (effectiveSourceType === "dailyChallenge") {
      if (!dailyChallengeId) {
        return res.status(400).json({ error: "dailyChallengeId is required for daily challenge gameplay" });
      }

      const [userExists, challengeExists] = await Promise.all([
        User.exists({ _id: userId }),
        DailyChallenge.exists({ _id: dailyChallengeId }),
      ]);

      if (!userExists) return res.status(404).json({ error: "User not found" });
      if (!challengeExists) return res.status(404).json({ error: "Daily challenge not found" });

      let gameplay = await Gameplay.findOne({ userId, dailyChallengeId, sourceType: "dailyChallenge" });
      if (!gameplay) {
        gameplay = await Gameplay.create({ userId, dailyChallengeId, sourceType: "dailyChallenge" });
      }

      return res.status(201).json({ success: true, gameplay });
    } else {
      return res.status(400).json({ error: "Invalid sourceType. Must be 'case' or 'dailyChallenge'" });
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/gameplays/:id
export const getGameplay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const gameplay = await Gameplay.findById(id)
      .populate("userId", "name email")
      .populate("caseId")
      .populate("dailyChallengeId");
    if (!gameplay) return res.status(404).json({ error: "Gameplay not found" });
    res.json({ success: true, gameplay });
  } catch (err) {
    next(err);
  }
};

// GET /api/gameplays?userId=&caseId=&dailyChallengeId=&sourceType=
export const listGameplays = async (req, res, next) => {
  try {
    const { userId, caseId, dailyChallengeId, sourceType } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (caseId) filter.caseId = caseId;
    if (dailyChallengeId) filter.dailyChallengeId = dailyChallengeId;
    if (sourceType) filter.sourceType = sourceType;
    const items = await Gameplay.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, gameplays: items });
  } catch (err) {
    next(err);
  }
};

// GET /api/gameplays/brief?userId=&status=
export const listGameplayBrief = async (req, res, next) => {
  try {
    const { userId, status } = req.query || {};
    if (!userId) return res.status(400).json({ error: "userId is required" });
    // Delegate to User model helper for consistency
    const items = await User.listGameplayBrief(userId, status);
    res.json({ success: true, items });
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

    // Snapshot before change to compute delta for cumulative points. If this is
    // the first time completing, baseline will be zeros below.
    const wasCompletedBefore = gameplay.status === "completed";
    const prevTotal = gameplay.points?.total || 0;

    if (typeof penaltiesDelta === "number") {
      gameplay.points.penalties = (gameplay.points.penalties || 0) + penaltiesDelta;
    }
    gameplay.points = computeTotals(gameplay.points);
    gameplay.status = "completed";
    gameplay.completedAt = new Date();
    await gameplay.save();

    // Update cumulative points: if first completion, add full; else add delta
    try {
      const newTotal = gameplay.points?.total || 0;
      const baselineTotal = wasCompletedBefore ? prevTotal : 0;
      const inc = { "cumulativePoints.total": newTotal - baselineTotal };
      await User.updateOne({ _id: gameplay.userId }, { $inc: inc });
      await updateLeaderboardForUser(gameplay.userId);
    } catch (_) { }

    // Upsert into User.completedCases for quick lookup (only for case type)
    if (gameplay.sourceType === "case" && gameplay.caseId) {
      try {
        await User.updateOne(
          { _id: gameplay.userId },
          {
            $addToSet: {
              completedCases: { case: gameplay.caseId, gameplay: gameplay._id },
            },
          }
        );
      } catch (_) { }
    }

    // Upsert into User.completedDailyChallenges for daily challenge type
    if (gameplay.sourceType === "dailyChallenge" && gameplay.dailyChallengeId) {
      try {
        await User.updateOne(
          { _id: gameplay.userId },
          {
            $addToSet: {
              completedDailyChallenges: { dailyChallenge: gameplay.dailyChallengeId, gameplay: gameplay._id },
            },
          }
        );
      } catch (_) { }

      // Update daily challenge leaderboard
      try {
        const challenge = await DailyChallenge.findById(gameplay.dailyChallengeId).select("date").lean();
        if (challenge?.date) {
          await DailyChallengeLeaderboard.updateOne(
            { date: challenge.date, userId: gameplay.userId },
            {
              $set: {
                dailyChallengeId: gameplay.dailyChallengeId,
                gameplayId: gameplay._id,
                score: gameplay.points?.total || 0,
                completedAt: gameplay.completedAt || new Date(),
              }
            },
            { upsert: true }
          );
        }
      } catch (_) { }
    }

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

// POST /api/gameplays/submit (without :id) or POST /api/gameplays/:id/submit
// Bulk submission of selections and optional completion in a single call
// Supports both Case and DailyChallenge gameplays
export const submitSelections = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      userId,
      caseId,
      dailyChallengeId,
      sourceType,
      diagnosisIndex,
      testIndices,
      treatmentIndices,
      penaltiesDelta,
      complete,
      points
    } = req.body || {};

    let gameplay = null;

    // If an id is provided, attempt to load it
    if (id) {
      gameplay = await Gameplay.findById(id);
      if (!gameplay && !userId) {
        return res.status(404).json({ error: "Gameplay not found. Provide userId and (caseId or dailyChallengeId) to create one." });
      }
    }

    // If no gameplay loaded, determine source type and find/create
    if (!gameplay) {
      if (!userId) {
        return res.status(400).json({ error: "userId is required when gameplay id is not found or not provided" });
      }

      // Determine source type
      const effectiveSourceType = sourceType || (dailyChallengeId ? "dailyChallenge" : "case");

      if (effectiveSourceType === "case") {
        if (!caseId) {
          return res.status(400).json({ error: "caseId is required for case gameplay" });
        }

        // Validate references exist
        const [userExists, caseExists] = await Promise.all([
          User.exists({ _id: userId }),
          Case.exists({ _id: caseId }),
        ]);
        if (!userExists) return res.status(404).json({ error: "User not found" });
        if (!caseExists) return res.status(404).json({ error: "Case not found" });

        gameplay = await Gameplay.findOne({ userId, caseId, sourceType: "case" });
        if (!gameplay) {
          gameplay = await Gameplay.create({ userId, caseId, sourceType: "case" });
        }
      } else if (effectiveSourceType === "dailyChallenge") {
        if (!dailyChallengeId) {
          return res.status(400).json({ error: "dailyChallengeId is required for daily challenge gameplay" });
        }

        // Validate references exist
        const [userExists, challengeExists] = await Promise.all([
          User.exists({ _id: userId }),
          DailyChallenge.exists({ _id: dailyChallengeId }),
        ]);
        if (!userExists) return res.status(404).json({ error: "User not found" });
        if (!challengeExists) return res.status(404).json({ error: "Daily challenge not found" });

        gameplay = await Gameplay.findOne({ userId, dailyChallengeId, sourceType: "dailyChallenge" });
        if (!gameplay) {
          gameplay = await Gameplay.create({ userId, dailyChallengeId, sourceType: "dailyChallenge" });
        }
      } else {
        return res.status(400).json({ error: "Invalid sourceType. Must be 'case' or 'dailyChallenge'" });
      }
    }

    // Snapshot prior state for delta computation against User.cumulativePoints
    const wasCompletedBefore = gameplay.status === "completed";
    const prevTotal = gameplay.points?.total || 0;

    // Diagnosis (store selection only; no history in submit)
    if (typeof diagnosisIndex === "number" && Number.isFinite(diagnosisIndex)) {
      gameplay.selections.diagnosisIndex = diagnosisIndex;
    }

    // Tests (dedupe; no history in submit)
    if (Array.isArray(testIndices)) {
      for (const idx of testIndices) {
        if (typeof idx === "number" && Number.isFinite(idx)) {
          if (!gameplay.selections.testIndices.includes(idx)) {
            gameplay.selections.testIndices.push(idx);
          }
        }
      }
    }

    // Treatments (dedupe; no history in submit)
    if (Array.isArray(treatmentIndices)) {
      for (const idx of treatmentIndices) {
        if (typeof idx === "number" && Number.isFinite(idx)) {
          if (!gameplay.selections.treatmentIndices.includes(idx)) {
            gameplay.selections.treatmentIndices.push(idx);
          }
        }
      }
    }

    // Optional penalties (kept for compatibility); no history in submit
    if (typeof penaltiesDelta === "number") {
      gameplay.points.penalties = (gameplay.points.penalties || 0) + penaltiesDelta;
    }

    // If frontend provided normalized points, persist as-is (frontend-only scoring)
    if (points && typeof points === "object") {
      const { total = 0, diagnosis = 0, tests = 0, treatment = 0, penalties = 0 } = points;
      gameplay.points = { total, diagnosis, tests, treatment, penalties };
    } else {
      // Fallback to maintaining totals if points not provided
      gameplay.points = computeTotals(gameplay.points);
    }

    // Optionally complete
    if (complete) {
      gameplay.status = "completed";
      gameplay.completedAt = new Date();
    }

    await gameplay.save();

    // Update User.cumulativePoints only when this call represents a completed state.
    // If completing for the first time, add full points. If already completed, add only the delta.
    if (complete) {
      try {
        const newTotal = gameplay.points?.total || 0;
        const baselineTotal = wasCompletedBefore ? prevTotal : 0;
        const inc = { "cumulativePoints.total": newTotal - baselineTotal };
        await User.updateOne({ _id: gameplay.userId }, { $inc: inc });
        await updateLeaderboardForUser(gameplay.userId);
      } catch (_) { }
    }

    // Track completed cases or daily challenges
    if (complete) {
      if (gameplay.sourceType === "case" && gameplay.caseId) {
        try {
          await User.updateOne(
            { _id: gameplay.userId },
            { $addToSet: { completedCases: { case: gameplay.caseId, gameplay: gameplay._id } } }
          );
        } catch (_) { }
      } else if (gameplay.sourceType === "dailyChallenge" && gameplay.dailyChallengeId) {
        try {
          await User.updateOne(
            { _id: gameplay.userId },
            { $addToSet: { completedDailyChallenges: { dailyChallenge: gameplay.dailyChallengeId, gameplay: gameplay._id } } }
          );
        } catch (_) { }

        // Update daily challenge leaderboard
        try {
          const challenge = await DailyChallenge.findById(gameplay.dailyChallengeId).select("date").lean();
          if (challenge?.date) {
            await DailyChallengeLeaderboard.updateOne(
              { date: challenge.date, userId: gameplay.userId },
              {
                $set: {
                  dailyChallengeId: gameplay.dailyChallengeId,
                  gameplayId: gameplay._id,
                  score: gameplay.points?.total || 0,
                  completedAt: gameplay.completedAt || new Date(),
                }
              },
              { upsert: true }
            );
          }
        } catch (_) { }
      }
    }

    // Fetch updated user data to return to frontend
    let updatedUser = null;
    if (complete) {
      try {
        const userDoc = await User.findById(gameplay.userId)
          .select("cumulativePoints completedCases completedDailyChallenges")
          .lean();
        if (userDoc) {
          updatedUser = {
            cumulativePoints: userDoc.cumulativePoints || { total: 0 },
            completedCasesCount: (userDoc.completedCases || []).length,
            completedDailyChallengesCount: (userDoc.completedDailyChallenges || []).length,
          };
        }
      } catch (_) { }
    }
    res.json({ success: true, gameplay, updatedUser });
  } catch (err) {
    next(err);
  }
};
