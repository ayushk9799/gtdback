/**
 * Personalized Push Notifications Service
 * 
 * Scalable implementation using:
 * - MongoDB Cursor for memory-safe streaming
 * - FCM sendEach for personalized batch notifications
 * - Automatic invalid token cleanup
 */

import { admin } from '../config/firebase-config.js';
import User from '../models/User.js';
import Case from '../models/Case.js';

const BATCH_SIZE = 500; // FCM sendEach limit

/**
 * Get a random unplayed case for a user using MongoDB aggregation
 */
async function getRandomUnplayedCase(user) {
    const playedIds = (user.completedCases || []).map(c => c.case);

    const [randomCase] = await Case.aggregate([
        { $match: { _id: { $nin: playedIds } } },
        { $sample: { size: 1 } },
        {
            $project: {
                _id: 1,
                'caseData.caseTitle': 1,
                'caseData.caseCategory': 1,
                'caseData.mainimage': 1
            }
        }
    ]);

    return randomCase || null;
}

/**
 * Build a personalized FCM message for a user
 */
function buildMessage(token, caseData) {
    const title = caseData?.caseData?.caseTitle || 'New clinical case';
    const category = caseData?.caseData?.caseCategory || '';
    const imageUrl = caseData?.caseData?.mainimage || undefined;

    return {
        token,
        notification: {
            title: '🩺 A case is waiting for you!',
            body: title,
            ...(imageUrl && { imageUrl })
        },
        data: {
            caseID: String(caseData._id),
            screen: 'ClinicalInfo'
        },
        android: {
            priority: 'high',
            notification: imageUrl ? { imageUrl } : undefined
        },
        apns: {
            headers: { 'apns-priority': '10' },
            fcm_options: imageUrl ? { image: imageUrl } : undefined
        },
    };
}

/**
 * Send a batch of messages and clean up invalid tokens
 */
async function sendBatch(messages) {
    if (messages.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

    try {
        const response = await admin.messaging().sendEach(messages);

        // Collect invalid tokens for cleanup
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const err = resp.error;
                const isUnregistered =
                    err?.code === 'messaging/registration-token-not-registered' ||
                    err?.errorInfo?.code === 'messaging/registration-token-not-registered';
                if (isUnregistered) {
                    invalidTokens.push(messages[idx].token);
                }
            }
        });

        // Remove invalid tokens from database
        let cleaned = 0;
        if (invalidTokens.length > 0) {
            const result = await User.updateMany(
                { fcmToken: { $in: invalidTokens } },
                { $unset: { fcmToken: 1 } }
            );
            cleaned = result.modifiedCount || 0;
            console.log(`Removed ${cleaned} invalid FCM tokens`);
        }

        return {
            sent: response.successCount,
            failed: response.failureCount,
            cleaned
        };
    } catch (error) {
        console.error('Batch send error:', error);
        return { sent: 0, failed: messages.length, cleaned: 0, error: error.message };
    }
}

/**
 * Main function: Send personalized notifications to all users with FCM tokens
 * Uses MongoDB cursor for memory-safe streaming
 */
export async function sendPersonalizedNotifications() {
    console.log('Starting personalized notifications job...');
    const startTime = Date.now();

    // Create cursor - streams users one by one, never loads all into memory
    const cursor = User.find({
        fcmToken: { $exists: true, $ne: null }
    })
        .select('_id fcmToken completedCases')
        .cursor();

    let batch = [];
    let stats = { totalSent: 0, totalFailed: 0, totalCleaned: 0, usersProcessed: 0, noCaseUsers: 0 };

    // Process users one by one
    for await (const user of cursor) {
        stats.usersProcessed++;

        // Find random unplayed case for this user
        const randomCase = await getRandomUnplayedCase(user);

        if (!randomCase) {
            stats.noCaseUsers++;
            continue; // User has completed all cases
        }

        // Build personalized message
        const message = buildMessage(user.fcmToken, randomCase);
        batch.push(message);

        // Send batch when full
        if (batch.length >= BATCH_SIZE) {
            const result = await sendBatch(batch);
            stats.totalSent += result.sent;
            stats.totalFailed += result.failed;
            stats.totalCleaned += result.cleaned;
            console.log(`Sent batch of ${batch.length} messages`);
            batch = [];

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // Send remaining messages
    if (batch.length > 0) {
        const result = await sendBatch(batch);
        stats.totalSent += result.sent;
        stats.totalFailed += result.failed;
        stats.totalCleaned += result.cleaned;
        console.log(`Sent final batch of ${batch.length} messages`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Job completed in ${duration}s:`, stats);

    return stats;
}

export default { sendPersonalizedNotifications };
