import { Type } from "@google/genai";

export const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    perQuestion: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["mcq", "trueFalse", "descriptive"],
          },
          prompt: { type: Type.STRING },
          candidateAnswer: {
            anyOf: [
              { type: Type.STRING },
              { type: Type.BOOLEAN },
              { type: Type.NUMBER },
            ],
          },
          maxMarks: { type: Type.NUMBER },
          awardedMarks: { type: Type.NUMBER },
          correctness: {
            type: Type.STRING,
            enum: ["correct", "incorrect", "partial", "unknown"],
          },
          feedback: { type: Type.STRING },
        },
        required: [
          "questionId",
          "type",
          "prompt",
          "candidateAnswer",
          "maxMarks",
          "awardedMarks",
          "correctness",
          "feedback",
        ],
      },
    },
    totalAwarded: { type: Type.NUMBER },
    totalPossible: { type: Type.NUMBER },
    percentage: { type: Type.NUMBER },
    overallFeedback: { type: Type.STRING },
  },
  required: [
    "perQuestion",
    "totalAwarded",
    "totalPossible",
    "percentage",
    "overallFeedback",
  ],
};