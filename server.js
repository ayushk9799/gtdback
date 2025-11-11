import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler.js";
import gameRoutes from "./routes/gameRoutes.js";
import loginRoutes from "./routes/loginRoute.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";
import mongoose from "mongoose";
import gameplayRoutes from "./routes/gameplayRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import dailyChallengeRoutes from "./routes/dailyChallengeRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
dotenv.config({ path: "./config/config.env" });

const app = express();

// Global middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {})
  .catch((err) => {});


// Routes
app.use("/api/login", loginRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/gameplays", gameplayRoutes);
app.use("/api/users", userRoutes);
app.use("/api", progressRoutes);
app.use("/api/daily-challenge", dailyChallengeRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/notification", notificationRoutes);
app.use("*", (req, res) => res.status(404).json({ msg: "Not found" }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {});
