import jwt from "jsonwebtoken";
import { config } from "../config.js";
import User from "../models/User.model.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log("Decoded token:", decoded);

    // Find user by id
    const user = await User.findById(decoded.userId).select("-password");
    console.log("User found:", user);

    if (!user || !user.is_verified) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists or is deactivated.",
      });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      ...user.toObject(),
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    let message = "Invalid or expired token.";

    if (error.name === "TokenExpiredError") {
      message = "Token has expired.";
    } else if (error.name === "JsonWebTokenError") {
      message = "Invalid token format.";
    } else if (error.name === "NotBeforeError") {
      message = "Token not active yet.";
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};


// import jwt from "jsonwebtoken";
// import { config } from "../config.js";
// import User from "../models/User.model.js";

// export const authenticateToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized access. No token provided.",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     // Verify Token
//     const decoded = jwt.verify(token, config.jwtSecret);
//     console.log("Decoded token:", decoded);

//     const user = await User.findById(decoded.userId).select("-password");

//     if (!user || !user.active) {
//       return res.status(401).json({
//         success: false,
//         message: "User no longer exists or is deactivated.",
//       });
//     }

//     req.user = {
//       userId: decoded.userId,
//       role: decoded.role,
//       ...user.toObject(),
//     };

//     next();
//   } catch (error) {
//     console.error("Auth error:", error);

//     let message = "Invalid or expired token.";
//     if (error.name === "TokenExpiredError") message = "Token has expired.";
//     if (error.name === "JsonWebTokenError") message = "Invalid token format.";
//     if (error.name === "NotBeforeError") message = "Token not active yet.";

//     return res.status(401).json({
//       success: false,
//       message,
//     });
//   }
// };

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(
          ", "
        )}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};
