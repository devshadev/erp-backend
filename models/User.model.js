import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true
    },
    password: { 
      type: String, 
      required: [true, "Password is required"] 
    },
    role: {
      type: String,
      enum: ["SUPERADMIN", "ADMIN", "MANAGER", "ACCOUNTANT"],
      default: "ADMIN",
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    is_verified: { 
      type: Boolean, 
      default: false 
    },
    lastLogin: { 
      type: Date 
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;