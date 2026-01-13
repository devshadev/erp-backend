import mongoose from "mongoose";

const ProctoringScreenshotSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: false,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      index: true,
      required: true,
    }, 

    sessionId: { type: String, index: true, required: true },
    testSlug: { type: String, index: true, required: true },
    takenAt: { type: Date, required: true },

    public_id: String,
    secure_url: String,
    width: Number,
    height: Number,
    bytes: Number,
    format: String,
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProctoringScreenshotSchema.index({
  candidate: 1,
  test: 1,
  sessionId: 1,
  takenAt: -1,
});

const Proctoring = mongoose.model(
  "ProctoringScreenshot",
  ProctoringScreenshotSchema
);
export default Proctoring;
