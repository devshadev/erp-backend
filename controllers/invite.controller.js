import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { decryptInviteToken, sha256, verifyInvite } from "../utils/invite.js";

export const resolveInvite = async (req, res, next) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) return next(new AppError("Missing token", 400));

    const rawJwt = await decryptInviteToken(token);
    if (!rawJwt) return next(new AppError("Decryption failed", 400));

    const payload = verifyInvite(rawJwt);
    const { sub: email, testId, candidateId, jti } = payload;

    const test = await Test.findById(testId);
    if (!test) return next(new AppError("Test not found", 404));
   
    // Convert candidateId to ObjectId for proper comparison
    const candidateObjectId = new mongoose.Types.ObjectId(candidateId);
    
    // Find candidate by ObjectId comparison
    const candidate = test.candidates.find(
      (c) => c.candidateId.equals(candidateObjectId)
    );

    if (!candidate) {
      return next(new AppError("Candidate not found in test", 400));
    }

    if (candidate.email.toLowerCase() !== email.toLowerCase()) {
      return next(new AppError("Email mismatch", 400));
    }

    if (new Date(test.accessDeadline) < new Date()) {
      return next(new AppError("Access deadline has passed", 410));
    }

    if (!candidate.invite?.jtiHash) {
      return next(new AppError("Invite not sent", 400));
    }

    // Handle missing expiresAt and invitedAt
    let inviteExpiresAt = candidate.invite.expiresAt;
    
    if (!inviteExpiresAt && candidate.invite.invitedAt) {
      // If expiresAt is missing but invitedAt exists, calculate expiry (60 minutes from invitedAt)
      const invitedAt = new Date(candidate.invite.invitedAt);
      const calculatedExpiry = new Date(invitedAt.getTime() + 60 * 60 * 1000); // 60 minutes
      inviteExpiresAt = new Date(Math.min(calculatedExpiry.getTime(), test.accessDeadline.getTime()));
      
    } else if (!inviteExpiresAt) {
      inviteExpiresAt = test.accessDeadline;
    }

    if (candidate.invite.usedAt) {
      return next(new AppError("Link already used", 410));
    }

    if (new Date(inviteExpiresAt) < new Date()) {

      return next(new AppError("Invite link expired", 410));
    }

    const expectedJtiHash = sha256(jti);

    if (candidate.invite.jtiHash !== expectedJtiHash) {
      console.log("ERROR: Invalid invite token");
      return next(new AppError("Invalid invite token", 400));
    }

    // Activate candidate
    const user = await User.findById(candidate.candidateId);
    if (!user) return next(new AppError("Candidate account missing", 500));

    user.active = true;
    user.emailVerified = true;
    user.lastLogin = new Date();
    await user.save();

    // Mark invite as used
    candidate.invite.usedAt = new Date();
    await test.save();

    // Issue session cookie
    const sessionJwt = jwt.sign(
      { uid: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res
      .cookie(process.env.APP_COOKIE_NAME, sessionJwt, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 3600 * 1000,
      })
      .status(200)
      .json({
        success: true,
        message: "Invite verified, account activated, session started.",
        redirectTo: `/tests/${test.slug || test._id}/lobby`,
        testId: test._id.toString(),
        slug: test.slug,
      });


  } catch (err) {
    console.error("ERROR in resolveInvite:", err);
    next(err);
  }
};