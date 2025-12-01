import { Router } from "express";
import { getNextCasesPerDepartment, getUser, updateUser, deleteUser } from "../controllers/userController.js";

const router = Router();

router.get("/:userID", getUser)
router.post("/:userID", updateUser)
router.delete("/:userID", deleteUser)
router.get("/:userId/next-cases", getNextCasesPerDepartment);

export default router;


