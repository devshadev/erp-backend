import express from "express";
import {
  addCandidatesToTest,
  createTest,
  getAllTests,
  getAssignedTestsToCandidate,
  getTestBySlug,
  getTestDetails,
} from "../controllers/test.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import {
  getAllAttempts,
  submitTestAttemptFromBody,
} from "../controllers/attempt.controller.js";
import { resolveInvite } from "../controllers/invite.controller.js";

const testRoutes = express.Router();

testRoutes.post(
  "/create",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  createTest
);

testRoutes.post("/invites/resolve", resolveInvite);
testRoutes.patch(
  "/add-candidates/:testId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  addCandidatesToTest
);
testRoutes.get(
  "/getAll",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getAllTests
);
testRoutes.get(
  "/my-tests",
  authenticateToken,
  authorizeRoles("CANDIDATE"),
  getAssignedTestsToCandidate
);
testRoutes.get(
  "/:testId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getTestDetails
);

testRoutes.get(
  "/slug/:slug",
  authenticateToken,
  authorizeRoles("CANDIDATE", "HR", "ADMIN"),
  getTestBySlug
);

testRoutes.post(
  "/submit",
  authenticateToken,
  authorizeRoles("CANDIDATE"),
  submitTestAttemptFromBody
);

export default testRoutes;
