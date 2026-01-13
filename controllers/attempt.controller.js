// controllers/attempt.controller.js
import Attempt from "../models/Attempt.model.js";
import Test from "../models/Test.model.js";
import AppError from "../utils/AppError.js";
import { evaluateWithGemini } from "../services/geminiEvaluate.service.js";
import User from "../models/User.model.js";
import mongoose from "mongoose";

/* ---------------- helpers (kept in this file) ---------------- */

const coerceBool = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return val;
};

const buildQuestionIndex = (testDoc) => {
  const ix = new Map();
  for (const q of testDoc.mcqs || []) {
    ix.set(String(q._id), {
      type: "mcq",
      prompt: q.question,
      marks: q.marks,
      options: q.options,
    });
  }
  for (const q of testDoc.trueFalse || []) {
    ix.set(String(q._id), {
      type: "trueFalse",
      prompt: q.question,
      marks: q.marks,
    });
  }
  for (const q of testDoc.descriptive || []) {
    ix.set(String(q._id), {
      type: "descriptive",
      prompt: q.question,
      marks: q.marks,
    });
  }
  return ix;
};

const normalizeAnswers = (answersMap = {}, qIndex) => {
  const out = [];
  for (const [qid, raw] of Object.entries(answersMap)) {
    const meta = qIndex.get(String(qid));
    if (!meta) continue;
    out.push({
      questionId: String(qid),
      type: meta.type,
      prompt: meta.prompt,
      marks: meta.marks,
      options: meta.type === "mcq" ? meta.options : undefined,
      answer: meta.type === "trueFalse" ? coerceBool(raw) : raw,
    });
  }
  return out;
};

const fetchTest = async (payload) => {
  const select =
    "mcqs trueFalse descriptive candidates accessDeadline slug testName";
  if (payload?.slug)
    return Test.findOne({ slug: payload.slug }).select(select).lean();
  if (payload?._id) return Test.findById(payload._id).select(select).lean();
  return null;
};

const assertSubmissionAllowed = (testDoc, userEmail) => {
  if (!testDoc) throw new AppError("Test not found", 404);

  const deadline = testDoc.accessDeadline
    ? new Date(testDoc.accessDeadline).getTime()
    : null;
  if (deadline && deadline < Date.now())
    throw new AppError("Access deadline has passed", 400);

  const invited = (testDoc.candidates || []).some((c) => c.email === userEmail);
  if (!invited) throw new AppError("You are not invited to this test", 403);
};

const markHasAttempted = async (testId, email) => {
  await Test.updateOne(
    { _id: testId, "candidates.email": email },
    { $set: { "candidates.$.hasAttempted": true } }
  ).lean();
};

/* ---------------- controller ---------------- */

export const submitTestAttemptFromBody = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next(new AppError("Not authenticated", 401));
    if (user.role !== "CANDIDATE")
      return next(new AppError("Only candidates can submit attempts", 403));

    const {
      test: testPayload,
      answers,
      durationSeconds,
      metadata,
    } = req.body || {};
    if (!testPayload || typeof testPayload !== "object") {
      return next(new AppError("test object is required in body", 400));
    }
    if (
      !answers ||
      typeof answers !== "object" ||
      !Object.keys(answers).length
    ) {
      return next(
        new AppError("answers map is required and cannot be empty", 400)
      );
    }

    const testDoc = await fetchTest(testPayload);
    assertSubmissionAllowed(testDoc, user.email);

    const candidateId = user.userId ?? user._id;

    const exists = await Attempt.findOne({
      test: testDoc._id,
      candidate: candidateId,
    })
      .select("_id")
      .lean();
    if (exists)
      return next(new AppError("You have already submitted this test", 400));

    const qIndex = buildQuestionIndex(testDoc);
    const normalized = normalizeAnswers(answers, qIndex);
    if (!normalized.length)
      return next(
        new AppError("No valid answers matched the test questions", 400)
      );

    const attempt = await Attempt.create({
      test: testDoc._id,
      candidate: candidateId,
      candidateEmail: user.email,
      submission: {
        testId: String(testDoc._id),
        slug: testDoc.slug,
        testName: testDoc.testName,
        metadata: metadata || {},
        answers: normalized,
        raw: req.body,
      },
      durationSeconds:
        typeof durationSeconds === "number" ? durationSeconds : undefined,
    });

    await markHasAttempted(testDoc._id, user.email);

    // Evaluate immediately
    let evaluation = null;
    try {
      evaluation = await evaluateWithGemini(attempt);
      attempt.status = "evaluated";
      attempt.evaluation = evaluation;
      await attempt.save();
    } catch (e) {
      return next(new AppError(`Evaluation failed: ${e.message}`, 502));
    }

    return res.status(201).json({
      status: 201,
      success: true,
      message: "Submission received and evaluated",
      attemptId: attempt._id,
      testId: String(testDoc._id),
      evaluation,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return next(new AppError("You have already submitted this test", 400));
    }
    next(err);
  }
};

export const getAllAttempts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build search query for attempts
    let searchQuery = {};

    if (search.trim()) {
      // Search by candidate email or find tests/users by name then match attempts
      const searchRegex = { $regex: search.trim(), $options: "i" };

      // Find matching tests and users in parallel
      const [matchingTests, matchingUsers] = await Promise.all([
        Test.find({ testName: searchRegex }).select("_id").lean(),
        User.find({ name: searchRegex }).select("_id").lean(),
      ]);

      const searchConditions = [
        { candidateEmail: searchRegex }, // Direct email search
      ];

      // Add test matches if found
      if (matchingTests.length > 0) {
        searchConditions.push({
          test: { $in: matchingTests.map((t) => t._id) },
        });
      }

      // Add user matches if found
      if (matchingUsers.length > 0) {
        searchConditions.push({
          candidate: { $in: matchingUsers.map((u) => u._id) },
        });
      }

      searchQuery = { $or: searchConditions };
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get all counts and attempts data in parallel
    const [
      total,
      totalTests,
      activeCandidates,
      totalEvaluated,
      totalReceived,
      attempts,
    ] = await Promise.all([
      Attempt.countDocuments(searchQuery),
      Test.countDocuments({}),
      User.countDocuments({ role: "CANDIDATE", active: true }),
      Attempt.countDocuments({ status: "evaluated" }),
      Attempt.countDocuments({ status: "received" }),
      Attempt.find(searchQuery)
        .populate("test", "testName slug category")
        .populate("candidate", "name email role")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      status: 200,
      success: true,
      data: attempts,
      stats: {
        total, // Total attempts matching search
        totalTests, // Total tests in system
        activeCandidates, // Active candidates in system
        totalEvaluated, // Attempts with status: "evaluated"
        totalReceived, // Attempts with status: "received"
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAttemptDetails = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const attempt = await Attempt.findById(attemptId)
      .populate("candidate")
      .lean();
    if (!attempt) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Test not found!",
      });
    }

    res.status(200).json({
      status: 200,
      success: true,
      message: "Test details fetched successfully.",
      attempt,
    });
  } catch (error) {
    next(error);
  }
};

// update attempt for manual remarks

export const updateAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { manualRemarks } = req.body;

    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Invalid attempt ID",
      });
    }

    const updated = await Attempt.findByIdAndUpdate(
      attemptId,
      { $set: { manualRemarks: manualRemarks.trim() } },
      { new: true, runValidators: true }
    )
      .populate("candidate")
      .lean();

    if (!updated) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Test not found!",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Remarks added successfully.",
      attempt: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Candidate attempts

export const getMyAttempts = async (req, res, next) => {
  try {
    const candidateId = req.user.userId ?? req.user._id;
    const [attempts, total, totalEvaluated] = await Promise.all([
      Attempt.find({ candidate: candidateId })
        .populate("test", "testName category")
        .populate("candidate", "name email role")
        .lean(),
      Attempt.countDocuments({ candidate: candidateId }),
      Attempt.countDocuments({ candidate: candidateId, status: "evaluated" }),
    ]);

    return res.status(200).json({
      status: 200,
      success: true,
      data: attempts,
      stats: {
        total,
        totalEvaluated,
      },
    });
  } catch (error) {
    next(error);
  }
};
