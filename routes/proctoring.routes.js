import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import { createProctoringScreenshot, getProctoringScreenshot } from "../controllers/proctoring.controller.js";
import multer from "multer";

const proctoringRoutes = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

proctoringRoutes.post(
  "/upload-screenshot",
  authenticateToken,
  authorizeRoles("CANDIDATE"),
  upload.single("file"),
  createProctoringScreenshot
);
proctoringRoutes.get(
  "/:attemptId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getProctoringScreenshot
);

export default proctoringRoutes;
