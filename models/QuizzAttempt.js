import mongoose from "mongoose";

const QuizzAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    quizzId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quizz",
        required: true,
    },
    selectedOption: {
        type: Number,
        required: true,
    },
    isCorrect: {
        type: Boolean,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Compound unique index to prevent duplicate attempts for the same quiz by same user
// and to enable efficient filtering of "fresh" quizzes.
QuizzAttemptSchema.index({ userId: 1, quizzId: 1 }, { unique: true });

const QuizzAttempt = mongoose.model("QuizzAttempt", QuizzAttemptSchema);

export default QuizzAttempt;
