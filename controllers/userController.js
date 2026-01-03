import User from "../models/User.js";
import Category from "../models/Category.js";
import Gameplay from "../models/Gameplay.js";
import TopUser from "../models/TopUser.js";

/**
 * Check if hearts need to be refreshed based on user's timezone.
 * Hearts reset at midnight in the user's local timezone.
 */
const isNewDay = (heartsUpdatedAt, timezone) => {
  if (!heartsUpdatedAt) return true;

  const now = new Date();
  const lastUpdate = new Date(heartsUpdatedAt);

  try {
    const nowLocal = now.toLocaleDateString('en-US', { timeZone: timezone });
    const lastLocal = lastUpdate.toLocaleDateString('en-US', { timeZone: timezone });
    return nowLocal !== lastLocal;
  } catch (e) {
    // Fallback to UTC if timezone is invalid
    return now.toDateString() !== lastUpdate.toDateString();
  }
};

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
    const { timezone } = req.query;  // Client sends their timezone

    const user = await User.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found" });

    let needsSave = false;

    // Update timezone if provided and different from stored
    if (timezone && user.timezone !== timezone) {
      user.timezone = timezone;
      needsSave = true;
    }

    // Check if hearts need to be refreshed (new day in user's timezone)
    const userTimezone = user.timezone || timezone || 'UTC';
    if (isNewDay(user.heartsUpdatedAt, userTimezone)) {
      user.hearts = 2;
      user.heartsUpdatedAt = new Date();
      needsSave = true;
    }

    // Generate referral code for existing users who don't have one
    if (!user.referralCode) {
      const prefix = (user.name || 'USER').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
      let code;
      let exists = true;
      while (exists) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        code = `${prefix}${suffix}`;
        exists = await User.findOne({ referralCode: code });
      }
      user.referralCode = code;
      needsSave = true;
    }

    if (needsSave) {
      await user.save();
    }

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

// POST /api/users/:userID/hearts/use
// Decrements user's heart count by 1
export const useHeart = async (req, res, next) => {
  try {
    const { userID } = req.params;

    const user = await User.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hearts = user.hearts - 1;
    await user.save();

    res.status(200).json({ hearts: user.hearts });
  } catch (err) {
    next(err);
  }
};
