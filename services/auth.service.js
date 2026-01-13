import { createAuthError, sanitizeUser } from "../helpers/index.js";
import User from "../models/User.model.js";
import { generateToken } from "../utils/generateToken.js";

export const loginUser = async (email, password) => {
  // Find user and exclude password from initial query for security
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw createAuthError("Invalid email or password");
  }

  const isPasswordValid = await user.matchPassword(password);
  if (!isPasswordValid) {
    throw createAuthError("Invalid email or password");
  }

  // Check if user is active
  if (!user.is_verified) {
    throw createAuthError("Hang on, admin approval needed.", 403);
  }

  user.lastLogin = new Date();
  await user.save();
  
  const token = generateToken(user._id, user.role);

  return {
    token,
    user: sanitizeUser(user),
  };
};
