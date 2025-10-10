import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema({
 
  caseData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const Case = mongoose.model("Case", CaseSchema);

export default Case;