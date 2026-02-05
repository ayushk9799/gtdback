import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';
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
import referralRoutes from "./routes/referralRoutes.js";
import quizzRoutes from "./routes/quizzRoutes.js";
import { startScheduler, stopScheduler } from "./jobs/notificationScheduler.js";

dotenv.config({ path: "./config/config.env" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use('/mp3files', express.static(path.join(__dirname, 'mp3files')));

// Connect to MongoDB and start scheduler
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    // Start Agenda scheduler after MongoDB is ready
    try {
      await startScheduler(process.env.MONGODB_URI);
    } catch (err) {
      console.error('Failed to start notification scheduler:', err);
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });


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
app.use("/api/referral", referralRoutes);
app.use("/api/quizz", quizzRoutes);
app.use("*", (req, res) => res.status(404).json({ msg: "Not found" }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3004;

const server = app.listen(PORT, () => {
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  try {
    await stopScheduler();
  } catch (err) {
    console.error('Error stopping scheduler:', err);
  }
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

