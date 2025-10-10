import { Router } from "express";
import { getNextCasesPerDepartment } from "../controllers/userController.js";

const router = Router();

router.get("/:userId/next-cases", getNextCasesPerDepartment);

export default router;


