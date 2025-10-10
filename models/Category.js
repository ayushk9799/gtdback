import mongoose from "mongoose";
import Case from "./Case.js";

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  taxonomy: {
    type: String,
    trim: true,
    unique: true,
  },
  caseCount:Number,
  caseList:[{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
  }],

});

// Ensure caseCount stays in sync with caseList length
CategorySchema.pre("save", function(next) {
  this.caseCount = Array.isArray(this.caseList) ? this.caseList.length : 0;
  next();
});

// Instance method: add a case to this category
CategorySchema.methods.addCase = async function(caseId) {
  const category = this;
  const objectId = typeof caseId === "string" ? new mongoose.Types.ObjectId(caseId) : caseId;

  const exists = await Case.exists({ _id: objectId });
  if (!exists) {
    throw new Error("Case not found");
  }

  const alreadyPresent = category.caseList.some((id) => id.toString() === objectId.toString());
  if (!alreadyPresent) {
    category.caseList.push(objectId);
  }

  await category.save();
  return category;
};

// Static helper: add a case to a category by id
CategorySchema.statics.addCaseToCategory = async function(categoryId, caseId) {
  const Category = this;
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error("Category not found");
  }
  return category.addCase(caseId);
};

const Category = mongoose.model("Category", CategorySchema);

export default Category;