import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema({
 
  caseData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Per-language translation overrides: { "de": { caseTitle: "...", steps: [...], mp3: {...} } }
  translations: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map(),
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