import errorHandler from "../middlewares/errorHandler.js";
import User from "../models/User.model.js";
import { loginUser } from "../services/auth.service.js";
import AppError from "../utils/AppError.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    // Set token in HttpOnly cookie
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: 200,
      success: true,
      message: "Login successful. Welcome back!",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const signup = async (req, res, next) => {
  try {
    const { username, email, phoneNumber, password, confirmPassword, role } = req.body;
    
    // Validate required fields
    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      return next(new AppError("All fields are required", 400));
    }

    // Validate password match
    if (password !== confirmPassword) {
      return next(new AppError("Passwords do not match", 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }, { phoneNumber }] 
    });
    
    if (existingUser) {
      return next(new AppError("Email, username, or phone number already in use", 400));
    }

    // Create new user with active: true (no approval needed)
    const newUser = await User.create({
      username,
      email,
      phoneNumber,
      password,
      role: role || "ADMIN",
      active: true, // ✅ Auto-approve user
    });

    res.status(201).json({
      status: 201,
      success: true,
      message: "Account created successfully! You can now login.",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      }
    });
  } catch (error) {
    next(error);
  }
};


export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",
    sameSite: "strict",
  });

  return res.status(200).json({
    succes: true,
    message: "Logged out Successfully.",
  });
};
