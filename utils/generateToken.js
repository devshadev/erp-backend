import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: "7d" });
};

