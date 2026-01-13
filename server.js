import mongoose from "mongoose";
import app from "./app.js";
import { config } from "./config.js";
import process from 'process';

const startServer = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("MongoDB connected successfully");
        app.listen(config.port, () => {
            console.log(`Server is running on port ${config.port}`);
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        process.exit(1);
    }
}

startServer();