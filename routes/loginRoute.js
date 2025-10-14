import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const router = Router();


// Google authentication route
router.post("/google/loginSignUp", async (req, res) => {
  try {
    const { token , platfrom} = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }
    let client;
    if (platfrom === "android") {
       client = new OAuth2Client(
        "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com"
      );
    } else {
       client = new OAuth2Client(
        "125181194595-joc9v9367fldq9qigu2bh9uoosq4u67d.apps.googleusercontent.com"
      );
    }
    
    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience:
        platfrom === "android" ? "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com" : "125181194595-joc9v9367fldq9qigu2bh9uoosq4u67d.apps.googleusercontent.com",
    });
    console.log("ticket", ticket);

    const payload = ticket.getPayload();
    console.log("payload", payload);

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
    console.error("Error verifying Google token:", error.message);
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
});

export default router;
