import Attempt from "../models/Attempt.model.js";
import AppError from "../utils/AppError.js";
import { evaluateWithGemini } from "../services/geminiEvaluate.service.js";

export const evaluateAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const force = String(req.query.force || "").toLowerCase() === "true";

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) return next(new AppError("Attempt not found", 404));

    if (attempt.status === "evaluated" && !force) {
      return res.status(200).json({
        success: true,
        message: "Already evaluated",
        evaluation: attempt.evaluation
      });
    }

    const evaluation = await evaluateWithGemini(attempt);

    attempt.status = "evaluated";
    attempt.evaluation = evaluation;
    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Evaluation complete",
      evaluation
    });
  } catch (err) {
    next(err);
  }
};
