import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import testRoutes from "./routes/test.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import proctoringRoutes from "./routes/proctoring.routes.js";
import { swaggerSpec, swaggerUi } from "./config/swagger.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/test", testRoutes);
app.use("/api/attempt", attemptRoutes);
app.use("/api/proctoring", proctoringRoutes);
app.use(errorHandler);

export default app;
