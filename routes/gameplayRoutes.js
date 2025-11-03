import { Router } from "express";
import {
  startOrGetGameplay,
  getGameplay,
  listGameplays,
  listGameplayBrief,
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
router.get("/brief", listGameplayBrief);
router.get("/:id", getGameplay);
router.patch("/:id/diagnosis", setDiagnosis);
router.patch("/:id/tests", addTestSelection);
router.patch("/:id/treatment", addTreatmentSelection);
// Allow submission without a gameplay id by using body (userId, caseId)
router.post("/submit", submitSelections);
router.post("/:id/complete", completeGameplay);
router.patch("/:id/reset", resetGameplay);

export default router;


