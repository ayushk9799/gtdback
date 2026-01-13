import { Router } from 'express';
import { sendToToken, sendToTopic } from '../utils/Notification.js';
import { triggerNow, getTimezonesAtTargetHoursNow } from '../jobs/notificationScheduler.js';
import User from '../models/User.js';
import Case from '../models/Case.js';

const router = Router();

router.post('/send-notification', async (req, res) => {
  const { token, title, body, data, imageUrl } = req.body;
  try {
    const resp = await sendToToken(token, title, body, data, imageUrl);
    res.status(200).json({ message: 'Notification sent successfully', response: resp });
  } catch (err) {
    res.status(500).json({ error: err.message, response: null });
  }
});

router.post('/send-to-topic', async (req, res) => {
  const { topic, title, body, data, imageUrl } = req.body;
  try {
    const resp = await sendToTopic(topic, title, body, data, imageUrl);
    res.status(200).json({ message: 'Notification sent successfully', response: resp });
  } catch (err) {
    res.status(500).json({ error: err.message, response: null });
  }
});

/**
 * Manually trigger personalized notifications job (for all users)
 * POST /api/notification/send-daily-personalized
 */
router.post('/send-daily-personalized', async (req, res) => {
  try {
    const result = await triggerNow();
    res.status(200).json({
      message: 'Personalized notification job triggered',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Test personalized notification to a specific FCM token
 * POST /api/notification/test-personalized
 * Body: { token: "fcm_token_here" } OR { userId: "user_id_here" }
 */
router.post('/test-personalized', async (req, res) => {
  try {
    const { token, userId } = req.body;

    let fcmToken = token;
    let user = null;

    // If userId provided, get user and their token
    if (userId) {
      user = await User.findById(userId).select('_id fcmToken completedCases').lean();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      fcmToken = user.fcmToken;
    } else if (token) {
      // Find user by token to get their completed cases
      user = await User.findOne({ fcmToken: token }).select('_id fcmToken completedCases').lean();
    }

    if (!fcmToken) {
      return res.status(400).json({ error: 'No FCM token provided or user has no token' });
    }

    // Get random unplayed case for this user
    const playedIds = (user?.completedCases || []).map(c => c.case);

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

    if (!randomCase) {
      return res.status(200).json({
        message: 'No unplayed cases available for this user',
        userId: user?._id
      });
    }

    // Build and send notification
    const title = '🩺 A case is waiting for you!';
    const body = randomCase.caseData?.caseTitle || 'New clinical case';
    const imageUrl = randomCase.caseData?.mainimage;
    const data = {
      caseID: String(randomCase._id),
      screen: 'ClinicalInfo'
    };

    const resp = await sendToToken(fcmToken, title, body, data, imageUrl);

    res.status(200).json({
      message: 'Test notification sent successfully',
      case: {
        id: randomCase._id,
        title: body,
        category: randomCase.caseData?.caseCategory
      },
      userId: user?._id,
      response: resp
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Debug: Check which timezones are currently at 12 AM or 8 AM
 * GET /api/notification/timezone-status
 */
router.get('/timezone-status', async (req, res) => {
  try {
    const targetTimezones = getTimezonesAtTargetHoursNow();
    const userCounts = await User.aggregate([
      { $match: { fcmToken: { $exists: true, $ne: null } } },
      { $group: { _id: '$timezone', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      currentTimeUTC: new Date().toISOString(),
      targetHours: [0, 8],
      timezonesAtTargetHours: targetTimezones,
      wouldNotifyUsers: targetTimezones.length > 0,
      usersByTimezone: userCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;