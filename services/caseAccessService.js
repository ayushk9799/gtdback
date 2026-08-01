import User from "../models/User.js";

export const FREE_CASE_LIMIT = 2;
export const FREE_CASE_LIMIT_CODE = "FREE_CASE_LIMIT_REACHED";

export const makeCaseAccessKey = (sourceType, resourceId) =>
  `${sourceType}:${resourceId.toString()}`;

export const getHistoricalAccessKeys = (user) => {
  const keys = new Set(user.freeCaseAccessKeys || []);

  for (const item of user.completedCases || []) {
    if (item?.case) keys.add(makeCaseAccessKey("case", item.case));
  }

  for (const item of user.completedDailyChallenges || []) {
    if (item?.dailyChallenge) {
      keys.add(makeCaseAccessKey("dailyChallenge", item.dailyChallenge));
    }
  }

  return [...keys];
};

export const canGrantCaseAccess = ({ isPremium, accessKeys, accessKey }) =>
  Boolean(isPremium)
  || accessKeys.includes(accessKey)
  || accessKeys.length < FREE_CASE_LIMIT;

// Atomically reserves one of the two free case slots. Existing/completed cases
// are always allowed, and premium users bypass the free-case limit.
export const reserveCaseAccess = async ({ userId, sourceType, resourceId }) => {
  const user = await User.findById(userId)
    .select("isPremium freeCaseAccessKeys completedCases.case completedDailyChallenges.dailyChallenge")
    .lean();

  if (!user) return { allowed: false, reason: "USER_NOT_FOUND" };
  if (user.isPremium) return { allowed: true, isPremium: true };

  const accessKey = makeCaseAccessKey(sourceType, resourceId);
  const historicalKeys = getHistoricalAccessKeys(user);

  // Lazily migrate existing completions into the authoritative access list.
  if (historicalKeys.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $addToSet: { freeCaseAccessKeys: { $each: historicalKeys } } }
    );
  }

  if (historicalKeys.includes(accessKey)) {
    return { allowed: true, alreadyGranted: true };
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      isPremium: { $ne: true },
      $expr: {
        $or: [
          { $in: [accessKey, { $ifNull: ["$freeCaseAccessKeys", []] }] },
          {
            $lt: [
              { $size: { $ifNull: ["$freeCaseAccessKeys", []] } },
              FREE_CASE_LIMIT,
            ],
          },
        ],
      },
    },
    { $addToSet: { freeCaseAccessKeys: accessKey } },
    { new: true }
  ).select("freeCaseAccessKeys");

  if (updatedUser) {
    return {
      allowed: true,
      used: updatedUser.freeCaseAccessKeys.length,
      limit: FREE_CASE_LIMIT,
    };
  }

  // The user may have become premium between the initial read and update.
  const latestUser = await User.findById(userId).select("isPremium").lean();
  if (latestUser?.isPremium) return { allowed: true, isPremium: true };

  return {
    allowed: false,
    reason: FREE_CASE_LIMIT_CODE,
    limit: FREE_CASE_LIMIT,
  };
};

export const sendCaseLimitResponse = (res) =>
  res.status(403).json({
    success: false,
    code: FREE_CASE_LIMIT_CODE,
    error: "Free case limit reached",
    limit: FREE_CASE_LIMIT,
  });
