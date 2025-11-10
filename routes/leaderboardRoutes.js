import express from "express";
import { getTopTen, getUserPosition } from "../controllers/leaderboardController.js";

const router = express.Router();

router.get("/top10", getTopTen);
router.get("/position/:userId", getUserPosition);

export default router;


