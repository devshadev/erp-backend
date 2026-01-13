import mongoose from "mongoose";

const CandidateInviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    invitedAt: { type: Date, default: Date.now },
    hasAttempted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "INVITED",
        "READY",
        "IN_PROGRESS",
        "SUBMITTED",
        "EXPIRED",
        "REVOKED",
      ],
      default: "INVITED",
    },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invite: {
      jtiHash: { type: String },
      expiredAt: { type: Date },
      usedAt: { type: Date },
      emailStatus: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED"],
        default: "PENDING",
      },
      lastError: { type: String },
    },
    firstOpenAt: { type: Date },
    startedAt: { type: Date },
    submittedAt: { type: Date },
  },
  { _id: false }
);

const CandidateInvite = mongoose.model(
  "CandidateInvite",
  CandidateInviteSchema
);

// Export both the schema AND the model
export { CandidateInviteSchema };  // ← This line was missing!
export default CandidateInvite;