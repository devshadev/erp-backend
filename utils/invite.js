import jwt from "jsonwebtoken";
import crypto, { createSecretKey } from "crypto";
import { compactDecrypt, CompactEncrypt } from "jose";

export const sha256 = (s) =>
  crypto.createHash("sha256").update(s).digest("hex");

export const signInvite = ({
  email,
  testId,
  candidateId,
  index,
  ttlMinutes = 60,
}) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: email,
      testId,
      candidateId,
      index,
    },
    process.env.INVITE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: ttlMinutes * 60, jwtid: jti }
  );

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  };
};

export const verifyInvite = (token) => {
  return jwt.verify(token, process.env.INVITE_JWT_SECRET, {
    algorithms: ["HS256"],
  });
};

export const deriveNameFromEmail = (email) => {
  const local = String(email).split("@")[0] || "Candidate";
  return local
    .replace(/[._-]+/g, "")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const randomPassword = () => {
  return crypto.randomBytes(24).toString("base64url");
};

// ---------- NEW: jose-based encryption helpers ----------
const ENC_KEY_B64U = process.env.INVITE_ENC_KEY;
if (!ENC_KEY_B64U) throw new Error("Missing INVITE_ENC_KEY");

const ENC_KEY = createSecretKey(Buffer.from(ENC_KEY_B64U, "base64url"));

if (ENC_KEY.export().length !== 32) {
  throw new Error("INVITE_ENC_KEY must decode to exactly 32 bytes");
}

export const encryptInviteToken = async (jwtToken) => {
  const jwe = await new CompactEncrypt(Buffer.from(jwtToken, "utf-8"))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(ENC_KEY);
  return jwe;
};

export const decryptInviteToken = async (jweToken) => {
  const { plaintext } = await compactDecrypt(jweToken, ENC_KEY);
  return new TextDecoder().decode(plaintext);
};
