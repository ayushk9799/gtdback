import { Router } from "express";
import {
    bulkUploadQuizzes,
    getAllQuizzes,
    bulkCreateQuizzCategories,
    getAllQuizzCategories,
    submitQuizzAttempt,
} from "../controllers/quizzController.js";

const router = Router();

router.post("/bulk", bulkUploadQuizzes);
router.post("/attempt", submitQuizzAttempt);
router.get("/", getAllQuizzes);

// Category routes
router.post("/category/bulk", bulkCreateQuizzCategories);
router.get("/category", getAllQuizzCategories);

export default router;
