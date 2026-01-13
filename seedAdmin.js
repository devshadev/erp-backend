import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.model.js";
import { config } from "./config.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(config.mongoUri);

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const adminUsername = process.env.SEED_ADMIN_USERNAME || "superadmin";
    const adminPhone = process.env.SEED_ADMIN_PHONE || "+1111111111";

    if (!adminEmail || !adminPassword) {
      console.error(
        "SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is missing in .env"
      );
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("Admin user already exists.");
      process.exit(0);
    }

    const admin = new User({
      username: adminUsername,
      email: adminEmail,
      phoneNumber: adminPhone,
      password: adminPassword,
      role: "SUPERADMIN",
      is_verified: true,
    });

    await admin.save();

    console.log("Admin user created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin user:", error.message);
    process.exit(1);
  }
};

seedAdmin();