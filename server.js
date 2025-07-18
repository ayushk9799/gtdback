import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler.js";
import gameRoutes from "./routes/gameRoutes.js";
import loginRoutes from "./routes/loginRoute.js";
import mongoose from "mongoose";
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

app.use("*", (req, res) => res.status(404).json({ msg: "Not found" }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {});
