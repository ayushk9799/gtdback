import mongoose from "mongoose";
import Gameplay from "./Gameplay.js";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  gender: {
    type: String,
    enum: ["Male", "Female"],
  },
  cumulativePoints: {
    total: { type: Number, default: 0 },
   
  },
  inTop10: {
    type: Boolean,
    default: false,
    index: true,
  },
  completedCases: [{
    case:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
    },
    gameplay:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gameplay",
    },
    
  }],
  completedDailyChallenges: [{
    dailyChallenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
    },
    gameplay: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gameplay",
    },
  }],
  fcmToken: {
    type: String,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumExpiresAt: {
    type: Date,
  },
  premiumPlan: {
    type: String,
  },

}, { timestamps: true });

// Static: Return brief gameplay list for a user with minimal case info
// Supports both Case and DailyChallenge gameplays
UserSchema.statics.listGameplayBrief = async function(userId, status) {
  if (!userId) throw new Error("userId is required");
  const filter = { userId };
  if (status) filter.status = status;

  const items = await Gameplay.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: "caseId", select: "caseData caseTitle caseCategory" })
    .populate({ path: "dailyChallengeId", select: "caseData metadata date" })
    .lean();

  return items.map((gp) => {
    const sourceType = gp.sourceType || "case";
    
    if (sourceType === "dailyChallenge") {
      const challengeDoc = gp.dailyChallengeId || {};
      const caseData = challengeDoc.caseData || {};
      const metadata = challengeDoc.metadata || {};
      const title = metadata.title || caseData.caseTitle || "";
      const category = metadata.category || caseData.caseCategory || "";
      let correctDiagnosis = "";
      try {
        const diags = (caseData.steps?.[2]?.data?.diagnosisOptions) || [];
        const correct = diags.find((d) => d && d.isCorrect);
        correctDiagnosis = correct?.diagnosisName || "";
      } catch (_) {}

      return {
        gameplayId: gp._id,
        sourceType: "dailyChallenge",
        status: gp.status,
        createdAt: gp.createdAt,
        dailyChallenge: {
          id: challengeDoc._id,
          date: challengeDoc.date,
          title,
          category,
          correctDiagnosis,
          mainimage: caseData.mainimage || null,
        },
      };
    } else {
      const caseDoc = gp.caseId || {};
      const caseData = caseDoc.caseData || {};
      const title = caseDoc.caseTitle || caseData.caseTitle || "";
      const category = caseDoc.caseCategory || caseData.caseCategory || "";
      let correctDiagnosis = "";
      try {
        const diags = (caseData.steps?.[2]?.data?.diagnosisOptions) || [];
        const correct = diags.find((d) => d && d.isCorrect);
        correctDiagnosis = correct?.diagnosisName || "";
      } catch (_) {}

      return {
        gameplayId: gp._id,
        sourceType: "case",
        status: gp.status,
        createdAt: gp.createdAt,
        case: {
          id: caseDoc._id,
          title,
          category,
          correctDiagnosis,
          mainimage: caseData.mainimage || null,
        },
      };
    }
  });
};

const User = mongoose.model("User", UserSchema);

export default User;
