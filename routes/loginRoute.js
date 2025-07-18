import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const router = Router();
const client = new OAuth2Client(
  "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com"
);

// Google authentication route
router.post("/google/loginSignUp", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience:
        "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    // Check if user exists
    let user = await User.findOne({ email: payload.email });

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        email: payload.email,
        name: payload.name,
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
});

export default router;
