import DailyChallengeLeaderboard from "../models/DailyChallengeLeaderboard.js";
import DailyChallenge from "../models/DailyChallenge.js";
import User from "../models/User.js";

/**
 * GET /api/daily-challenge/leaderboard/today
 * Get leaderboard for today's daily challenge
 */
export const getTodayLeaderboard = async (req, res, next) => {
    try {
        const { userId } = req.query;
        const userTimezone = req.query.timezone || "UTC";

        // Get today's date in user's timezone
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: userTimezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const today = formatter.format(new Date());

        // Delegate to the date-based function
        return getDailyChallengeLeaderboardByDate(today, userId, res, next);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/daily-challenge/leaderboard/:date
 * Get leaderboard for a specific date's daily challenge
 */
export const getDailyChallengeLeaderboard = async (req, res, next) => {
    try {
        const { date } = req.params;
        const { userId } = req.query;

        // Validate date format
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }

        return getDailyChallengeLeaderboardByDate(date, userId, res, next);
    } catch (err) {
        next(err);
    }
};

/**
 * Internal helper to fetch leaderboard by date
 */
async function getDailyChallengeLeaderboardByDate(date, userId, res, next) {
    try {
        // Get the daily challenge for this date
        const challenge = await DailyChallenge.findOne({ date })
            .select("metadata.title metadata.category caseData.caseTitle")
            .lean();

        if (!challenge) {
            return res.status(404).json({
                success: false,
                error: "No daily challenge found for this date",
                date,
            });
        }

        const challengeTitle =
            challenge.metadata?.title ||
            challenge.caseData?.caseTitle ||
            "Daily Challenge";
        const category = challenge.metadata?.category || "";

        // Get top 10 players
        const topEntries = await DailyChallengeLeaderboard.getTopForDate(date, 10);

        const top10 = topEntries.map((entry, idx) => ({
            rank: idx + 1,
            userId: entry.userId?._id || entry.userId,
            name: entry.userId?.name || "Unknown",
            score: entry.score || 0,
            completedAt: entry.completedAt,
        }));

        // Get total participants
        const totalParticipants = await DailyChallengeLeaderboard.getParticipantCount(date);

        // Get current user's position if userId provided
        let me = null;
        if (userId) {
            const userRank = await DailyChallengeLeaderboard.getUserRankForDate(date, userId);
            if (userRank) {
                const user = await User.findById(userId).select("name email").lean();
                me = {
                    userId,
                    name: user?.name || "",
                    rank: userRank.rank,
                    score: userRank.score,
                    completedAt: userRank.completedAt,
                };
            }
        }

        res.json({
            success: true,
            date,
            challengeId: challenge._id,
            challengeTitle,
            category,
            top10,
            me,
            totalParticipants,
        });
    } catch (err) {
        next(err);
    }
}
