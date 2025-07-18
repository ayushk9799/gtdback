import { Router } from "express";
import {
  startGame,
  continueGame,
  testOutput,
  getConfig,
  testMatching,
} from "../controllers/gameController.js";

const router = Router();

// POST /api/game/start -> initializes a new session
router.post("/start", startGame);

// POST /api/game/:sessionId -> continue an existing session
router.post("/:sessionId", continueGame);

// GET /api/game/history -> get game history for debugging variety

// GET /api/game/config -> get current configuration
router.get("/config", getConfig);

// POST /api/game/test -> test different output modes
router.post("/test", testOutput);

// POST /api/game/test-matching -> test disease matching functionality
router.post("/test-matching", testMatching);

export default router;
