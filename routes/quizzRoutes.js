import { Router } from "express";
import {
    bulkUploadQuizzes,
    getAllQuizzes,
    bulkCreateQuizzCategories,
    getAllQuizzCategories,
    submitQuizzAttempt,
    getNextQuizzPreview,
    updateQuizzTranslation,
    bulkUpdateQuizzTranslations,
} from "../controllers/quizzController.js";

const router = Router();

router.post("/bulk", bulkUploadQuizzes);
router.post("/attempt", submitQuizzAttempt);
router.get("/next-preview", getNextQuizzPreview);
router.get("/", getAllQuizzes);

// Category routes
router.post("/category/bulk", bulkCreateQuizzCategories);
router.get("/category", getAllQuizzCategories);
router.put("/:id/translations/:lang", updateQuizzTranslation);
router.put("/translations/bulk", bulkUpdateQuizzTranslations);

export default router;
