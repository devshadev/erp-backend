import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import { getAllAttempts, getAttemptDetails, getMyAttempts, updateAttempt } from "../controllers/attempt.controller.js";

const attemptRoutes = express.Router();

attemptRoutes.get(
  "/getAll",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getAllAttempts
);

attemptRoutes.get("/mine", authenticateToken, authorizeRoles("CANDIDATE"), getMyAttempts);
attemptRoutes.get(
  "/:attemptId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN", "CANDIDATE"),
  getAttemptDetails
);
attemptRoutes.patch(
  "/remarks/:attemptId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  updateAttempt
);


export default attemptRoutes;
