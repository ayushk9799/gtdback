import { Router } from "express";
import { getDepartmentProgress } from "../controllers/progressController.js";

const router = Router();

router.get("/users/:userId/progress/department", getDepartmentProgress);

export default router;


