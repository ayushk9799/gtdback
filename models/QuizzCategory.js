import mongoose from "mongoose";
import Quizz from "./Quizz.js";

const QuizzCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    quizzCount: {
        type: Number,
        default: 0
    },
    quizzList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quizz",
    }],
}, { timestamps: true });

// Ensure quizzCount stays in sync with quizzList length
QuizzCategorySchema.pre("save", function (next) {
    this.quizzCount = Array.isArray(this.quizzList) ? this.quizzList.length : 0;
    next();
});

// Instance method: add a quizz to this category
QuizzCategorySchema.methods.addQuizz = async function (quizzId) {
    const category = this;
    const objectId = typeof quizzId === "string" ? new mongoose.Types.ObjectId(quizzId) : quizzId;

    // We can't use Quizz.exists because of circular dependency if we are not careful
    // But here Quizz is already imported.
    const exists = await Quizz.exists({ _id: objectId });
    if (!exists) {
        throw new Error("Quizz not found");
    }

    const alreadyPresent = category.quizzList.some((id) => id.toString() === objectId.toString());
    if (!alreadyPresent) {
        category.quizzList.push(objectId);
    }

    await category.save();
    return category;
};

// Static helper: add a quizz to a category by id
QuizzCategorySchema.statics.addQuizzToCategory = async function (categoryId, quizzId) {
    const QuizzCategory = this;
    const category = await QuizzCategory.findById(categoryId);
    if (!category) {
        throw new Error("Quizz Category not found");
    }
    return category.addQuizz(quizzId);
};

const QuizzCategory = mongoose.model("QuizzCategory", QuizzCategorySchema);

export default QuizzCategory;
