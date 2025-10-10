import { Router } from "express";
import {
  startOrGetGameplay,
  getGameplay,
  listGameplays,
  setDiagnosis,
  addTestSelection,
  addTreatmentSelection,
  completeGameplay,
  resetGameplay,
  submitSelections,
} from "../controllers/gameplayController.js";

const router = Router();

router.post("/", startOrGetGameplay);
router.get("/", listGameplays);
router.get("/:id", getGameplay);
router.patch("/:id/diagnosis", setDiagnosis);
router.patch("/:id/tests", addTestSelection);
router.patch("/:id/treatment", addTreatmentSelection);
router.post("/:id/complete", completeGameplay);
router.patch("/:id/reset", resetGameplay);
router.post("/:id/submit", submitSelections);

export default router;


