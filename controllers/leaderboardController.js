import TopUser from "../models/TopUser.js";
import User from "../models/User.js";

// GET /api/leaderboard/top10
export const getTopTen = async (req, res, next) => {
  try {
    const { userId } = req.query || {};

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const top = await TopUser.find({
      updatedAt: { $gte: sevenDaysAgo }
    })
      .sort({ score: -1, _id: 1 })
      .limit(10)
      .populate({ path: "userId", select: "name email inTop10 isPremium" })
      .lean();

    const items = top.map((entry, idx) => ({
      rank: idx + 1,
      userId: entry.userId?._id || entry.userId,
      name: entry.userId?.name || "",
      inTop10: !!entry.userId?.inTop10,
      isPremium: !!entry.userId?.isPremium,
      score: entry.score || 0,
    }));

    let me = null;
    if (userId) {
      const userDoc = await User.findById(userId).select("cumulativePoints.total inTop10 name email isPremium").lean();
      if (userDoc) {
        const myScore = userDoc.cumulativePoints?.total || 0;
        const ahead = await TopUser.countDocuments({ 
          score: { $gt: myScore },
          updatedAt: { $gte: sevenDaysAgo }
        });

        const myTopEntry = await TopUser.findOne({ userId }).select("updatedAt").lean();

        me = {
          userId,
          name: userDoc.name || "",
          email: userDoc.email || "",
          inTop10: !!userDoc.inTop10,
          isPremium: !!userDoc.isPremium,
          score: myScore,
          rank: ahead + 1,
          updatedAt: myTopEntry?.updatedAt || null,
        };
      }
    }

    res.json({ success: true, top10: items, me });
  } catch (err) {
    next(err);
  }
};

// GET /api/leaderboard/position/:userId
export const getUserPosition = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const user = await User.findById(userId).select("cumulativePoints.total inTop10 name email isPremium").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const score = user.cumulativePoints?.total || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Compute position as number of users with strictly greater score + 1
    const aheadCount = await TopUser.countDocuments({ 
      score: { $gt: score },
      updatedAt: { $gte: sevenDaysAgo }
    });
    const position = aheadCount + 1;

    const myTopEntry = await TopUser.findOne({ userId }).select("updatedAt").lean();

    res.json({
      success: true,
      user: {
        userId,
        name: user.name || "",
        email: user.email || "",
        inTop10: !!user.inTop10,
        isPremium: !!user.isPremium,
        score,
        position,
        updatedAt: myTopEntry?.updatedAt || null,
      },
    });
  } catch (err) {
    next(err);
  }
};


