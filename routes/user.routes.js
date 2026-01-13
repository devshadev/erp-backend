import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import {
  approveUser,
  createUser,
  getAllUsers,
  rejectUser,
} from "../controllers/user.controller.js";

const userRoutes = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - phoneNumber
 *         - password
 *         - role
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 30
 *           description: Unique username (3-30 characters)
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           description: Valid email address
 *           example: john.doe@example.com
 *         phoneNumber:
 *           type: string
 *           description: Valid phone number in international format
 *           example: +1234567890
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: Password (minimum 8 characters)
 *           example: SecurePass123!
 *         role:
 *           type: string
 *           enum: [MANAGER, ACCOUNTANT]
 *           description: User role (only MANAGER and ACCOUNTANT can be created)
 *           example: MANAGER
 *     ApproveUserRequest:
 *       type: object
 *       properties:
 *         role:
 *           type: string
 *           enum: [SUPERADMIN, ADMIN, MANAGER, ACCOUNTANT]
 *           description: Optional - assign role during approval
 *           example: MANAGER
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         username:
 *           type: string
 *           description: Username
 *         email:
 *           type: string
 *           description: User email
 *         phoneNumber:
 *           type: string
 *           description: User phone number
 *         role:
 *           type: string
 *           enum: [SUPERADMIN, ADMIN, MANAGER, ACCOUNTANT]
 *           description: User role
 *         is_verified:
 *           type: boolean
 *           description: Account verification status
 *         createdBy:
 *           type: string
 *           description: ID of admin who created the user
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 */

/**
 * @swagger
 * /api/user/create-user:
 *   post:
 *     summary: Create a new user (MANAGER or ACCOUNTANT)
 *     description: Admin can create new users with MANAGER or ACCOUNTANT roles. User is auto-verified and receives a welcome email.
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: MANAGER account created successfully
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: All fields are required
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions (ADMIN role required)
 *       409:
 *         description: Conflict - user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Email is already registered
 */
userRoutes.post(
  "/create-user",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createUser
);

/**
 * @swagger
 * /api/users/getAll:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users in the system (requires ADMIN or HR role)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved users list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions (ADMIN or HR role required)
 */
userRoutes.get(
  "/getAll",
  authenticateToken,
  authorizeRoles("ADMIN", "HR"),
  getAllUsers
);

/**
 * @swagger
 * /api/user/approve/{userId}:
 *   patch:
 *     summary: Approve/activate a user account
 *     description: Activate an unverified user account and optionally assign a role
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to approve
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApproveUserRequest'
 *     responses:
 *       200:
 *         description: User approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User account activated successfully
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     is_verified:
 *                       type: boolean
 *       400:
 *         description: Bad request - invalid user ID or user already active
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User is already active
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 */
userRoutes.patch(
  "/approve/:userId",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER", "ACCOUNTANT", "SUPERADMIN"),
  approveUser
);

/**
 * @swagger
 * /api/users/reject/{userId}:
 *   delete:
 *     summary: Reject and delete an unverified user
 *     description: Reject a user registration request and permanently delete the account
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to reject and delete
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: User rejected and deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User request rejected and deleted successfully.
 *       400:
 *         description: Bad request - cannot reject an active user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cannot reject an active user
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions (ADMIN role required)
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 */
userRoutes.delete(
  "/reject/:userId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  rejectUser
);

export default userRoutes;