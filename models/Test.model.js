import mongoose from "mongoose";
import { CandidateInviteSchema } from "./CandidateInvite.model.js";  // ← Changed this line

const testSchema = mongoose.Schema(
  {
    testName: { type: String, required: true },
    category: { type: String, required: true },
    duration: { type: Number, required: true },
    description: { type: String, required: true },
    mcqs: [
      {
        question: String,
        options: [String],
        marks: Number,
      },
    ],

    trueFalse: [{ question: String, marks: Number }],
    descriptive: [{ question: String, marks: Number }],
    candidates: [CandidateInviteSchema],  // ← Changed this line
    accessDeadline: { type: Date, required: true },
    enableProctoring: { type: Boolean, default: true },
    screenShotFrequency: { type: Number, required: true },
    fullScreenForce: { type: Boolean, default: true },
    testLink: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", testSchema);
export default Test;