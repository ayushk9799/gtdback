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

        if (!userId) {
            return res.status(400).json({ success: false, error: "User ID required" });
        }

        // Find the user applying the code
        const applicant = await User.findById(userId);
        if (!applicant) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        // Check if user has already applied a referral code
        if (applicant.appliedReferralCode) {
            return res.status(400).json({
                success: false,
                message: "You have already applied a referral code"
            });
        }

        // Find referrer by code
        const referrer = await User.findOne({
            referralCode: referralCode.toUpperCase()
        });

        if (!referrer) {
            return res.status(404).json({ success: false, message: "Invalid referral code" });
        }

        // Prevent self-referral
        if (referrer._id.toString() === userId) {
            return res.status(400).json({ success: false, message: "Cannot use your own code" });
        }

        // Give referrer +1 heart
        referrer.hearts += 1;
        await referrer.save();

        // Mark that this user has applied a referral code
        applicant.appliedReferralCode = referralCode.toUpperCase();
        await applicant.save();

        res.json({ success: true, message: "Referral code applied. Your friend received a heart!" });
    } catch (err) {
        next(err);
    }
});

// GET /api/referral/status/:userId
// Check if user has already applied a referral code
router.get("/status/:userId", async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('appliedReferralCode');
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({
            success: true,
            hasAppliedCode: !!user.appliedReferralCode,
            appliedCode: user.appliedReferralCode
        });
    } catch (err) {
        next(err);
    }
});

export default router;
