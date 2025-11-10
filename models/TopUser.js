import mongoose from "mongoose";

const TopUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

TopUserSchema.index({ score: -1, _id: 1 });

const TopUser = mongoose.model("TopUser", TopUserSchema);

export default TopUser;


