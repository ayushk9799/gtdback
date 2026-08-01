import { Router } from "express";
import { getNextCasesPerDepartment, getUser, updateUser, deleteUser, useHeart } from "../controllers/userController.js";

const router = Router();

router.get("/:userID", getUser)
router.post("/:userID", updateUser)
router.delete("/:userID", deleteUser)
router.post("/:userID/hearts/use", useHeart)
router.get("/:userId/next-cases", getNextCasesPerDepartment);

export default router;
