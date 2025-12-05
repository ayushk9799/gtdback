import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema({
 
  caseData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  mp3: {
    basicspeech: { type: String, default: null },
    vitalsspeech: { type: String, default: null },
    historyspeech: { type: String, default: null },
    physicalspeech: { type: String, default: null },
  },
  voiceId: {
    type: String,
    default: null,
  },
});

const Case = mongoose.model("Case", CaseSchema);

export default Case;