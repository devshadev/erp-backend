import mongoose from "mongoose";
import { userRoles } from "../constants/index.js";
import errorHandler from "../middlewares/errorHandler.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { sendEmail } from "../utils/sendEmail.js";

export const createUser = async (req, res, next) => {
  try {
    const { username, email, phoneNumber, password, role } = req.body;

    // Validate required fields
    if (!username || !email || !phoneNumber || !password || !role) {
      return next(new AppError("All fields are required", 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new AppError("Please provide a valid email address", 400));
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return next(new AppError("Please provide a valid phone number", 400));
    }

    // Validate password strength
    if (password.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long", 400)
      );
    }

    // Validate username format
    if (username.length < 3 || username.length > 30) {
      return next(
        new AppError("Username must be between 3 and 30 characters", 400)
      );
    }

    // Validate that only MANAGER and ACCOUNTANT can be created
    const allowedRoles = ["MANAGER", "ACCOUNTANT"];
    if (!allowedRoles.includes(role)) {
      return next(
        new AppError(
          `Invalid role. Only ${allowedRoles.join(" and ")} can be created`,
          400
        )
      );
    }

    // Check if user already exists with specific field identification
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phoneNumber }],
    });

    if (existingUser) {
      let conflictField = "User";
      if (existingUser.email === email) conflictField = "Email";
      else if (existingUser.username === username) conflictField = "Username";
      else if (existingUser.phoneNumber === phoneNumber)
        conflictField = "Phone number";

      return next(
        new AppError(`${conflictField} is already registered`, 409)
      );
    }

    // Create new user - auto-verified since created by admin
    const newUser = new User({
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      phoneNumber: phoneNumber.trim(),
      password,
      role,
      is_verified: true,
      createdBy: req.user.userId,
      createdAt: new Date(),
    });

    await newUser.save();

    // Send welcome email (non-blocking)
    sendEmail(
      newUser.email,
      "Welcome to the Platform",
      "templates/account-created-by-admin.html",
      {
        username: newUser.username,
        role: newUser.role,
        loginLink: `${process.env.FRONTEND_URL}/login`,
        temporaryPassword: password,
      }
    ).catch((emailError) => {
      console.error(
        `Failed to send welcome email to ${newUser.email}:`,
        emailError.message
      );
    });

    // Log user creation for audit trail
    console.log(
      `[USER CREATED] ${role} account created by ${req.user.userId} - User ID: ${newUser._id}`
    );

    res.status(201).json({
      success: true,
      message: `${role} account created successfully`,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        is_verified: newUser.is_verified,
        createdBy: req.user.userId,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return next(new AppError(`Validation Error: ${messages.join(", ")}`, 400));
    }

    // Handle duplicate key errors (if unique indexes exist)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return next(
        new AppError(
          `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
          409
        )
      );
    }

    // Handle other errors
    console.error("[CREATE USER ERROR]:", error);
    next(new AppError("Failed to create user. Please try again later", 500));
  }
};


export const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        success: false,
        message: "Not Authenticated",
      });
    }

    res.status(200).json({
      status: 200,
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};


export const approveUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format.",
      });
    }

    const user = await User.findById(userId);
    if (!user) return next(new AppError("User not found", 404));
    if (user.is_verified) return next(new AppError("User is already active", 400));

    user.is_verified = true;
    user.role = role || user.role;
    user.createdBy = req.user.userId;
    await user.save();


    res.status(200).json({
      success: true,
      message: "User account activated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return next(new errorHandler("User not found", 404));
    if (user.is_verified)
      return next(new errorHandler("Cannot reject an active user", 400));

    await user.deleteOne();
    res.status(200).json({
      success: true,
      message: "User request rejected and deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};


export const getPendingUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const query = {
      active: false,
      role: "CANDIDATE",
      name: { $regex: search, $options: "i" },
    };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email createdAt")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      role,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Base search query for name/email
    let searchQuery = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    if (role) {
      searchQuery.role = role.toUpperCase();
    }

    if (status === "active") {
      searchQuery = { ...searchQuery, active: true };
    } else if (status === "inactive") {
      searchQuery = { ...searchQuery, active: false };
    }

    // Counts (all aligned with searchQuery so your stats reflect current filters)
    const [
      totalUsers,           // <-- overall (matching current filters)
      totalAdmins,
      totalHRs,
      totalCandidates,
      totalActiveUsers,
      totalInactiveUsers
    ] = await Promise.all([
      User.countDocuments(searchQuery),
      User.countDocuments({ ...searchQuery, role: "ADMIN" }),
      User.countDocuments({ ...searchQuery, role: "HR" }),
      User.countDocuments({ ...searchQuery, role: "CANDIDATE" }),
      User.countDocuments({ ...searchQuery, active: true }),
      User.countDocuments({ ...searchQuery, active: false }),
    ]);

    const users = await User.find(searchQuery)
      .select("-password -otp -otpExpiry")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: users,
      stats: {
        totalAdmins,
        totalHRs,
        totalCandidates,
        totalActiveUsers,
        totalInactiveUsers,
      },
      pagination: {
        totalUsers,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalUsers / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

