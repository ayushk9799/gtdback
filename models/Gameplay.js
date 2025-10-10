import mongoose from "mongoose";

const GameplaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
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

// Exactly one gameplay per user per case
GameplaySchema.index({ userId: 1, caseId: 1 }, { unique: true });
GameplaySchema.index({ status: 1, startedAt: -1 });

const Gameplay = mongoose.model("Gameplay", GameplaySchema);

export default Gameplay;


