import jwt from "jsonwebtoken";

export const authenticateCandidate = (req, res, next) => {
  const raw =
    req.cookies?.[process.env.APP_COOKIE_NAME] ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!raw) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(raw, process.env.APP_JWT_SECRET);
    req.user = { uid: payload.uid, role: payload.role };
  } catch (error) {
    return res.status(401).json({ message: "Invalid Session" });
  }
};
