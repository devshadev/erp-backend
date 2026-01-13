import ai from "../lib/gemini.js";
import { evaluationSchema } from "../models/Evaluation.model.js";
import { systemInstruction } from "../constants/index.js";

/** Build a compact payload from Attempt for cheaper, consistent eval */
export function buildEvaluationPayloadFromAttempt(attempt) {
  const A = attempt?.submission?.answers || [];
  return {
    testId: attempt?.submission?.testId,
    slug: attempt?.submission?.slug,
    testName: attempt?.submission?.testName,
    candidateEmail: attempt?.candidateEmail,
    durationSeconds: attempt?.durationSeconds ?? null,
    questions: A.map((a) => ({
      id: a.questionId,
      type: a.type,
      prompt: a.prompt ?? a.question, // tolerant to either name
      options: a.type === "mcq" ? a.options : undefined,
      marks: a.marks ?? 0,
    })),
    answers: A.reduce((acc, a) => {
      acc[a.questionId] = a.answer;
      return acc;
    }, {}),
  };
}

/** Clamp numbers & recompute totals for safety */
function sanitizeEvaluation(payload) {
  const out = { ...payload };
  let totalAwarded = 0;
  let totalPossible = 0;

  out.perQuestion = (payload.perQuestion || []).map((q) => {
    const max = Number(q.maxMarks ?? 0);
    let awarded = Number(q.awardedMarks ?? 0);
    if (!Number.isFinite(awarded)) awarded = 0;
    if (awarded < 0) awarded = 0;
    if (awarded > max) awarded = max;
    totalAwarded += awarded;
    totalPossible += max;
    return { ...q, maxMarks: max, awardedMarks: awarded };
  });

  out.totalAwarded = Number.isFinite(payload.totalAwarded)
    ? payload.totalAwarded
    : totalAwarded;
  out.totalPossible = Number.isFinite(payload.totalPossible)
    ? payload.totalPossible
    : totalPossible;
  out.percentage =
    out.totalPossible > 0
      ? Math.round((out.totalAwarded / out.totalPossible) * 100)
      : 0;

  return out;
}

/** Call Gemini and return evaluation JSON */
export async function evaluateWithGemini(attempt) {
  const evalPayload = buildEvaluationPayloadFromAttempt(attempt);

  const userPrompt = `
Evaluate the candidate's answers and return JSON only.

INPUT:
${JSON.stringify(evalPayload, null, 2)}
`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: evaluationSchema,
    },
    systemInstruction,
  });

  const raw = result.text; // JSON string per config
  const parsed = JSON.parse(raw); // parse
  return sanitizeEvaluation(parsed); // clamp numbers & totals
}
