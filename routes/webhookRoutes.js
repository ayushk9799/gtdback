import express from "express";
import User from "../models/User.js";

const router = express.Router();

/**
 * RevenueCat Webhook Endpoint
 * POST /api/webhook/revenuecat
 * 
 * Receives subscription events from RevenueCat and updates user premium status.
 * 
 * RevenueCat Event Types:
 * - INITIAL_PURCHASE: First time purchase
 * - RENEWAL: Subscription renewed
 * - PRODUCT_CHANGE: User changed subscription plan
 * - CANCELLATION: User cancelled (still active until expiration)
 * - EXPIRATION: Subscription expired
 * - BILLING_ISSUES_WILL_RENEW: Billing issue detected
 * - SUBSCRIBER_ALIAS: User identified
 */
router.post("/revenuecat", async (req, res) => {
    try {
        // Verify authorization header
        const authHeader = req.headers["authorization"];
        const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const event = req.body;
        const eventType = event?.type;
        const appUserId = event?.app_user_id;



        if (!appUserId) {
            return res.status(400).json({ error: "Missing app_user_id" });
        }

        // Find user by ID (RevenueCat app_user_id should be the MongoDB user ID)
        const user = await User.findById(appUserId);
        if (!user) {
            // Return 200 to prevent RevenueCat from retrying for non-existent users
            return res.status(200).json({ message: "User not found, skipping" });
        }

        // Handle different event types
        switch (eventType) {
            case "INITIAL_PURCHASE":
            case "RENEWAL":
            case "PRODUCT_CHANGE":
            case "UNCANCELLATION": {
                // Activate or extend premium
                const expirationAtMs = event?.expiration_at_ms;
                const productId = event?.product_id || null;

                const updateData = {
                    isPremium: true,
                    premiumPlan: productId,
                };

                // Set expiration date if provided (null for lifetime purchases)
                if (expirationAtMs) {
                    updateData.premiumExpiresAt = new Date(expirationAtMs);
                } else {
                    // Lifetime purchase - set far future date or null
                    updateData.premiumExpiresAt = null;
                }

                await User.findByIdAndUpdate(appUserId, updateData);
                break;
            }

            case "EXPIRATION":
            case "BILLING_ISSUES_WILL_RENEW": {
                // Deactivate premium
                await User.findByIdAndUpdate(appUserId, {
                    isPremium: false,
                    premiumExpiresAt: null,
                    premiumPlan: null,
                });
                break;
            }

            case "CANCELLATION": {
                // User cancelled but subscription is still active until expiration
                break;
            }

            case "SUBSCRIBER_ALIAS":
            case "TRANSFER": {
                // These are informational events, no action needed
                break;
            }

            default:
                break;
        }

        // Always return 200 to acknowledge receipt
        return res.status(200).json({ success: true });

    } catch (error) {
        // Return 500 so RevenueCat will retry
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
