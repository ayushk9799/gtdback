import mongoose from "mongoose";

/**
 * DailyChallengeLeaderboard Model
 * Stores per-day rankings for daily challenges.
 * One entry per user per date.
 */
const DailyChallengeLeaderboardSchema = new mongoose.Schema(
    {
        // Date in YYYY-MM-DD format (matches DailyChallenge.date)
        date: {
            type: String,
            required: true,
            index: true,
            validate: {
                validator: function (v) {
                    return /^\d{4}-\d{2}-\d{2}$/.test(v);
                },
                message: "Date must be in YYYY-MM-DD format",
            },
        },

        // Reference to the user
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Reference to the daily challenge
        dailyChallengeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DailyChallenge",
            required: true,
        },

        // Reference to the gameplay
        gameplayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gameplay",
            required: true,
        },

        // Score achieved in this daily challenge
        score: {
            type: Number,
            required: true,
            default: 0,
            index: true,
        },

        // When the challenge was completed
        completedAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Compound unique index: one entry per user per date
DailyChallengeLeaderboardSchema.index({ date: 1, userId: 1 }, { unique: true });

// Index for ranking queries (sorted by score descending)
DailyChallengeLeaderboardSchema.index({ date: 1, score: -1 });

// Static method to get top N for a specific date
DailyChallengeLeaderboardSchema.statics.getTopForDate = async function (date, limit = 10) {
    return this.find({ date })
        .sort({ score: -1, completedAt: 1 }) // Higher score first, earlier completion as tiebreaker
        .limit(limit)
        .populate({ path: "userId", select: "name email" })
        .lean();
};

// Static method to get user's rank for a specific date
DailyChallengeLeaderboardSchema.statics.getUserRankForDate = async function (date, userId) {
    const userEntry = await this.findOne({ date, userId }).lean();
    if (!userEntry) return null;

    // Count users with higher score
    const aheadCount = await this.countDocuments({
        date,
        score: { $gt: userEntry.score },
    });

    return {
        rank: aheadCount + 1,
        score: userEntry.score,
        completedAt: userEntry.completedAt,
    };
};

// Static method to get total participants for a date
DailyChallengeLeaderboardSchema.statics.getParticipantCount = function (date) {
    return this.countDocuments({ date });
};

const DailyChallengeLeaderboard = mongoose.model(
    "DailyChallengeLeaderboard",
    DailyChallengeLeaderboardSchema
);

export default DailyChallengeLeaderboard;
