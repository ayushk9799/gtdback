import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const router = Router();

// Apple JWKS client for verifying Apple identity tokens
const appleJwksClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});


// Google authentication route
router.post("/google/loginSignUp", async (req, res) => {
  try {
    const { token, platform } = req.body;
    let flag = 0;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }
    let client;
    if (platform === "android") {
      client = new OAuth2Client(
        "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com"
      );
    } else {
      client = new OAuth2Client(
        "125181194595-joc9v9367fldq9qigu2bh9uoosq4u67d.apps.googleusercontent.com"
      );
      flag = 1;
    }

    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience:
        platform === "android" ? "125181194595-uautevfk4s33h57gi28hougs7lruet70.apps.googleusercontent.com" : "125181194595-joc9v9367fldq9qigu2bh9uoosq4u67d.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    // Check if user exists
    let user = await User.findOne({ email: payload.email });
    let isNewUser = false;

    if (!user) {
      // Create new user if doesn't exist
      isNewUser = true;
      user = await User.create({
        email: payload.email,
        name: payload.name,
        platform: flag == 1 ? "ios" : platform,
      });
    }

    res.json({
      success: true,
      isNewUser,
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

// Helper function to get Apple signing key
function getAppleSigningKey(header, callback) {
  appleJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

// Apple authentication route
router.post("/apple/loginSignUp", async (req, res) => {
  try {
    const { idToken: idToken, authorizationCode, displayName, email: providedEmail, platform } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Identity token is required" });
    }

    // Verify the Apple identity token
    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        getAppleSigningKey,
        {
          algorithms: ["RS256"],
          issuer: "https://appleid.apple.com",
          audience: "com.thousandways.gtd1",
          // audience should be your app's bundle identifier
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        }
      );
    });

    // Extract email from token or use provided email
    // Apple only provides email on first sign-in, so we need to handle both cases
    const email = decodedToken.email || providedEmail;
    const appleUserId = decodedToken.sub; // Apple's unique user identifier

    if (!email) {
      return res.status(400).json({
        error: "Email is required. Please try signing in again."
      });
    }

    // Build name from provided displayName object
    // let name = "Apple User";
    // if (displayName) {
    //   const nameParts = [];
    //   if (displayName.givenName) nameParts.push(displayName.givenName);
    //   if (displayName.familyName) nameParts.push(displayName.familyName);
    //   if (nameParts.length > 0) {
    //     name = nameParts.join(" ");
    //   }
    // }

    // Check if user exists by email
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      // Create new user if doesn't exist
      isNewUser = true;
      user = await User.create({
        email,
        name: displayName,
        platform: platform || 'ios',
      });
    }

    res.json({
      success: true,
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Error verifying Apple token:", error.message);
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
});

export default router;