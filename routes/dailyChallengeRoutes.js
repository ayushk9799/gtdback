import { Router } from "express";
import {
  getTodaysChallenge,
  getChallengeByDate,
  createDailyChallenge,
  updateDailyChallenge,
  deleteDailyChallenge,
  getAllDailyChallenges,
  populateDailyChallenges
} from "../controllers/dailyChallengeController.js";
import {
  getTodayLeaderboard,
  getDailyChallengeLeaderboard
} from "../controllers/dailyChallengeLeaderboardController.js";

const router = Router();

// Leaderboard routes (must be before /:date to avoid route conflict)
// GET /api/daily-challenge/leaderboard/today - Get today's daily challenge leaderboard
router.get("/leaderboard/today", getTodayLeaderboard);

// GET /api/daily-challenge/leaderboard/:date - Get leaderboard for a specific date
router.get("/leaderboard/:date", getDailyChallengeLeaderboard);

// Public routes (for frontend)
// GET /api/daily-challenge/today - Get today's challenge
router.get("/today", getTodaysChallenge);

// GET /api/daily-challenge/:date - Get challenge by specific date (with timezone validation)
router.get("/:date", getChallengeByDate);


// Admin routes (for managing challenges)
// POST /api/daily-challenge - Create new daily challenge
router.post("/", createDailyChallenge);

// PUT /api/daily-challenge/:date - Update daily challenge
router.put("/:date", updateDailyChallenge);

// DELETE /api/daily-challenge/:date - Delete daily challenge
router.delete("/:date", deleteDailyChallenge);

// GET /api/daily-challenge - Get all daily challenges (with pagination)
router.get("/", getAllDailyChallenges);

// POST /api/daily-challenge/populate - Populate daily challenges from CASES_ARRAY
router.post("/populate", populateDailyChallenges);

export default router;
