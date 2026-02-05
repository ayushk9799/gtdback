import mongoose from "mongoose";

const QuizzSchema = new mongoose.Schema({
    case_title: {
        type: String,
    },
    clinicalImages: {
        type: [String],
    },
    complain: {
        type: String,
    },
    options: {
        type: [String],
    },
    correctOptionIndex: {
        type: Number,
        min: 0,
        max: 3,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuizzCategory",
    },
    department: {
        type: String,
    },
    explain: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, { timestamps: true });

const Quizz = mongoose.model("Quizz", QuizzSchema);

export default Quizz;
