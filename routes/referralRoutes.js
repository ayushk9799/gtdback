import { Router } from "express";
import User from "../models/User.js";

const router = Router();

// POST /api/referral/apply
// Apply a referral code and give +1 heart to the referrer
router.post("/apply", async (req, res, next) => {
    try {
        const { referralCode, userId } = req.body;

        if (!referralCode) {
            return res.status(400).json({ success: false, error: "Referral code required" });
        }

        // Find referrer by code
        const referrer = await User.findOne({
            referralCode: referralCode.toUpperCase()
        });

        if (!referrer) {
            return res.status(404).json({ success: false, error: "Invalid referral code" });
        }

        // Prevent self-referral
        if (userId && referrer._id.toString() === userId) {
            return res.status(400).json({ success: false, error: "Cannot use your own code" });
        }

        // Give referrer +1 heart
        referrer.hearts += 1;
        await referrer.save();

        res.json({ success: true, message: "Referral applied! Your friend earned a heart." });
    } catch (err) {
        next(err);
    }
});

export default router;
