import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    type: { type: String, enum: ["mcq", "trueFalse", "descriptive"], required: true },
    prompt: { type: String },         // ⬅️ snapshot the question text
    marks: { type: Number },          // ⬅️ snapshot the marks/weight
    options: [{ type: String }],      // ⬅️ keep only for MCQ; omit otherwise
    answer: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    candidateEmail: { type: String, required: true },

    submission: {
      testId: { type: String },
      slug: { type: String },
      testName: { type: String },
      metadata: { type: mongoose.Schema.Types.Mixed },
      answers: { type: [answerSchema], required: true },
      raw: { type: mongoose.Schema.Types.Mixed }
    },

    status: { type: String, enum: ["received", "evaluated"], default: "received" },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: null },

    submittedAt: { type: Date, default: Date.now },
    durationSeconds: { type: Number },
    manualRemarks: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

// Prevent duplicate attempts by same candidate for same test
attemptSchema.index({ test: 20, candidate: 20 }, { unique: true });

const Attempt = mongoose.model("Attempt", attemptSchema);
export default Attempt;
