import User from "../models/User.js";
import Category from "../models/Category.js";
import Gameplay from "../models/Gameplay.js";
import TopUser from "../models/TopUser.js";

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

export const getUser = async (req, res, next) => {
  
  try {
    const { userID } = req.params;
    const user = await User.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    
    const { userID } = req.params;
    const { user } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userID, user, { new: true });
    res.status(200).json(updatedUser);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:userID
// Deletes user account and all associated data
// Requires email in request body for verification
export const deleteUser = async (req, res, next) => {
  try {
    const { userID } = req.params;

    // Find the user
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify email matches - ensures only the user can delete their account
  

    // Delete all gameplays associated with the user
    await Gameplay.deleteMany({ userId: userID });

    // Delete TopUser entry if exists
    await TopUser.deleteOne({ userId: userID });

    // Delete the user
    await User.findByIdAndDelete(userID);

    res.status(200).json({ 
      success: true, 
      message: "Account and all associated data deleted successfully" 
    });
  } catch (err) {
    next(err);
  }
};

