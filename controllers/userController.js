import User from "../models/User.js";
import Category from "../models/Category.js";
import Gameplay from "../models/Gameplay.js";

// GET /api/users/:userId/next-cases
// Returns per-category the next unplayed case (first case in each category not in completed list)
export const getNextCasesPerDepartment = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("_id completedCases");
    if (!user) return res.status(404).json({ error: "User not found" });

    const completedCaseIds = new Set(
      (user.completedCases || [])
        .map((c) => (c && c.case ? c.case.toString() : null))
        .filter(Boolean)
    );

    // Also exclude cases with completed gameplay records (source of truth)
    const finished = await Gameplay.find({ userId, status: "completed" }).select("caseId");
    for (const gp of finished) completedCaseIds.add(gp.caseId.toString());

    const categories = await Category.find().select("name caseCount caseList").populate("caseList");

    const result = [];
    for (const cat of categories) {
      if (!Array.isArray(cat.caseList) || cat.caseList.length === 0) continue;
      const nextCase = cat.caseList.find((c) => !completedCaseIds.has(c._id.toString()));
      if (nextCase) {
        result.push({
          categoryId: cat._id,
          categoryName: cat.name,
          case: {
            id: nextCase._id,
            caseData: nextCase.caseData,
          },
        });
      }
    }

    res.json({ success: true, nextByDepartment: result });
  } catch (err) {
    next(err);
  }
};


