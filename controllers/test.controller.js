import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import {
  deriveNameFromEmail,
  encryptInviteToken,
  randomPassword,
  sha256,
  signInvite,
} from "../utils/invite.js";
import { sendEmail } from "../utils/sendEmail.js";

export const createTest = async (req, res, next) => {
  try {
    const {
      testName,
      category,
      duration,
      description,
      mcqs,
      trueFalse,
      descriptive,
      accessDeadline,
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
    } = req.body;

    if (
      !testName ||
      !category ||
      !duration ||
      !description ||
      !Array.isArray(mcqs) ||
      !Array.isArray(trueFalse) ||
      !Array.isArray(descriptive) ||
      !accessDeadline ||
      enableProctoring === undefined ||
      screenShotFrequency === undefined ||
      fullScreenForce === undefined
    ) {
      return next(new AppError("Required fields are missing", 400));
    }

    const slug = Math.random().toString(36).substring(2, 11);
    const testLink = `${process.env.FRONTEND_URL}/test/${slug}`;

    const newTest = await Test.create({
      testName,
      category,
      duration,
      description,
      mcqs,
      trueFalse,
      descriptive,
      candidateEmails: [],
      accessDeadline: new Date(accessDeadline),
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
      testLink,
      slug,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      status: 201,
      success: true,
      message: "Test created successfully.",
      test: newTest,
    });
  } catch (error) {
    next(error);
  }
};

// Updated addCandidatesToTest with better debugging
export const addCandidatesToTest = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { testId } = req.params;
    const { candidateEmails, accessDeadline } = req.body;

    if (!Array.isArray(candidateEmails) || candidateEmails.length === 0)
      return next(new AppError("Candidate emails are required", 400));

    const deadlineDate = new Date(accessDeadline);
    if (deadlineDate <= new Date())
      return next(new AppError("Access deadline must be in the future", 400));

    await session.startTransaction();

    const test = await Test.findById(testId).session(session);
    if (!test) throw new AppError("Test not found", 404);

    const existingEmails = new Set(
      test.candidates.map((c) => c.email.toLowerCase())
    );
    const toAdd = candidateEmails
      .map((email) => email.trim().toLowerCase())
      .filter((e) => e && !existingEmails.has(e));

    if (toAdd.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        status: 200,
        success: true,
        message: "No new candidates to add",
      });
    }


    const invites = [];
    const perEmail = [];

    for (let i = 0; i < toAdd.length; i++) {
      const email = toAdd[i];
      const normalizedEmail = email.trim().toLowerCase();
      
      let user = await User.findOne({ email: normalizedEmail }).session(session);
      let createdUser = false;
      
      if (!user) {
        try {
          user = new User({
            email: normalizedEmail,
            name: deriveNameFromEmail(normalizedEmail),
            role: "CANDIDATE",
            password: randomPassword(),
            active: false,
            emailVerified: false,
            createdBy: req.user?._id,
          });
          
          await user.save({ session });
          createdUser = true;
        } catch (error) {
          if (error.code === 11000) {
            console.log("Duplicate user detected, fetching existing");
            user = await User.findOne({ email: normalizedEmail }).session(session);
            if (!user) {
              throw new Error(`User creation failed for ${normalizedEmail}`);
            }
          } else {
            throw error;
          }
        }
      }

      // Generate the JWT token for the invite
      const { token, jti, expiresAt } = signInvite({
        email: normalizedEmail,
        testId: test._id.toString(),
        candidateId: user._id.toString(),
        ttlMinutes: 60,
      });

      // Create candidate object with ALL properties set
      const candidateObj = {
        email: normalizedEmail,
        candidateId: user._id,
        status: "INVITED",
        invite: {
          emailStatus: "PENDING",
          jtiHash: sha256(jti),
          expiresAt: new Date(
            Math.min(expiresAt.getTime(), deadlineDate.getTime())
          ),
        },
      };

      // Add the candidate to the test
      test.candidates.push(candidateObj);
      invites.push({ email: normalizedEmail, token });
      perEmail.push({
        email: normalizedEmail,
        createdUser,
        addedToTest: true,
        inviteCreated: true,
      });
    }

    // Mark the test as modified to ensure Mongoose saves it
    test.markModified('candidates');
    const savedTest = await test.save({ session });
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Send emails after committing DB
    await Promise.allSettled(
      invites.map(async ({ email, token }) => {
        try {
          const encryptedToken = await encryptInviteToken(token);
          const startLink = `${process.env.FRONTEND_URL}/invite?token=${encodeURIComponent(encryptedToken)}`;

          const result = await sendEmail(
            email,
            "You're invited to take a Test",
            "./templates/invite-email.html",
            {
              name: "Candidate",
              testName: test.testName,
              accessDeadline: test.accessDeadline.toLocaleString(),
              startLink,
            }
          );
          
          return { email, success: true };
        } catch (error) {
          console.error("Failed to send email to:", email, error);
          return { email, success: false, error: error.message };
        }
      })
    );

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Candidates pre-registered, linked to test, and invitations sent.",
      candidatesAdded: toAdd.length,
      perEmail,
    });

  } catch (err) {
    console.error("Error in addCandidatesToTest:", err);
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError);
    }
    session.endSession();
    
    return next(
      err instanceof AppError
        ? err
        : new AppError(`Failed to add candidates: ${err.message}`, 500)
    );
  }
};

export const getAllTests = async (req, res, next) => {
  try {
    const tests = await Test.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "All test fetched successfully.",
      total: tests.length,
      tests,
    });
  } catch (error) {
    next(error);
  }
};

export const getTestDetails = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
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
      test,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTestsToCandidate = async (req, res, next) => {
  try {
    const user = req.user; // Get logged-in user details
    if (user.role !== "CANDIDATE") {
      // Ensure the user is a candidate
      return res.status(403).json({
        status: 403,
        success: false,
        message: "Access Denied. Only candidates can access this resource",
      });
    }

    const assignedTests = await Test.find({
      "candidates.email": user.email,
    })
      .select(
        "testName category description duration accessDeadline testLink slug createdAt candidates"
      )
      .sort({ createdAt: -1 });
    const testsWithStatus = assignedTests.map((test) => {
      const candidate = test.candidates.find((c) => c.email === user.email);

      const hasAttempted = candidate ? candidate.hasAttempted : false;

      const { candidates, ...testWithoutCandidates } = test.toObject();

      return {
        ...testWithoutCandidates,
        hasAttempted,
      };
    });

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Assigned tests retrieved successfully.",
      total: testsWithStatus.length,
      tests: testsWithStatus, // Return the modified tests
    });
  } catch (error) {
    next(error);
  }
};

export const getTestBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const userId = req.user._id;

    const test = await Test.findOne({ slug })
      .populate("createdBy", "name email role")
      .populate("candidates", "name email");

    if (!test) {
      return res.status(404).json({
        success: 404,
        success: false,
        message: "Test not found",
      });
    }

    const isCandidate = test.candidates.some((c) => c.email === req.user.email);
    const isCreator = test.createdBy.toString() === req.user._id.toString();

    if (!isCreator && !isCandidate) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You are not authorized to view this test!",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Test fetched successfully by slug",
      test,
    });
  } catch (error) {
    next(error);
  }
};
