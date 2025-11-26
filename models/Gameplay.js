import mongoose from "mongoose";

const GameplaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Source type to identify whether this gameplay is for a Case or DailyChallenge
    sourceType: {
      type: String,
      enum: ["case", "dailyChallenge"],
      required: true,
      default: "case",
    },
    // Reference to Case (optional - required if sourceType is 'case')
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      index: true,
      default: null,
    },
    // Reference to DailyChallenge (optional - required if sourceType is 'dailyChallenge')
    dailyChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      index: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    selections: {
      diagnosisIndex: { type: Number, default: null },
      testIndices: { type: [Number], default: [] },
      treatmentIndices: { type: [Number], default: [] },
    },
    points: {
      total: { type: Number, default: 0 },
      diagnosis: { type: Number, default: 0 },
      tests: { type: Number, default: 0 },
      treatment: { type: Number, default: 0 },
      penalties: { type: Number, default: 0 },
    },
    history: [
      {
        type: {
          type: String,
          enum: ["diagnosis", "test", "treatment", "penalty"],
        },
        index: { type: Number },
        deltaPoints: { type: Number },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Validation: exactly one of caseId or dailyChallengeId must be set based on sourceType
GameplaySchema.pre("validate", function (next) {
  if (this.sourceType === "case") {
    if (!this.caseId) {
      return next(new Error("caseId is required when sourceType is 'case'"));
    }
    this.dailyChallengeId = null;
  } else if (this.sourceType === "dailyChallenge") {
    if (!this.dailyChallengeId) {
      return next(new Error("dailyChallengeId is required when sourceType is 'dailyChallenge'"));
    }
    this.caseId = null;
  }
  next();
});

// Partial unique index for Case gameplays: one gameplay per user per case
GameplaySchema.index(
  { userId: 1, caseId: 1 },
  { unique: true, partialFilterExpression: { caseId: { $ne: null } } }
);

// Partial unique index for DailyChallenge gameplays: one gameplay per user per daily challenge
GameplaySchema.index(
  { userId: 1, dailyChallengeId: 1 },
  { unique: true, partialFilterExpression: { dailyChallengeId: { $ne: null } } }
);

GameplaySchema.index({ status: 1, startedAt: -1 });
GameplaySchema.index({ sourceType: 1 });

const Gameplay = mongoose.model("Gameplay", GameplaySchema);

export default Gameplay;
