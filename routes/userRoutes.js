import { Router } from "express";
import { getNextCasesPerDepartment, getUser, updateUser } from "../controllers/userController.js";

const router = Router();

router.get("/:userID", getUser)
router.post("/:userID", updateUser)
router.get("/:userId/next-cases", getNextCasesPerDepartment);

export default router;


