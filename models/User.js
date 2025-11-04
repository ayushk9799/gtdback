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
    diagnosis: { type: Number, default: 0 },
    tests: { type: Number, default: 0 },
    treatment: { type: Number, default: 0 },
    penalties: { type: Number, default: 0 },
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
  fcmToken: {
    type: String,
  },
}, { timestamps: true });

// Static: Return brief gameplay list for a user with minimal case info
UserSchema.statics.listGameplayBrief = async function(userId, status) {
  if (!userId) throw new Error("userId is required");
  const filter = { userId };
  if (status) filter.status = status;

  const items = await Gameplay.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: "caseId", select: "caseData caseTitle caseCategory" })
    .lean();

  return items.map((gp) => {
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
      status: gp.status,
      createdAt: gp.createdAt,
      case: {
        id: caseDoc._id,
        title,
        category,
        correctDiagnosis,
      },
    };
  });
};

const User = mongoose.model("User", UserSchema);

export default User;
