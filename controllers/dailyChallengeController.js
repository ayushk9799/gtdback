import DailyChallenge from "../models/DailyChallenge.js";
import User from "../models/User.js";
import Gameplay from "../models/Gameplay.js";

// Get today's daily challenge
export const getTodaysChallenge = async (req, res, next) => {
  try {
    // Get user timezone from query parameter or header, default to UTC
    // const userTimezone = req.query.timezone || req.headers['user-timezone'] || 'UTC';

    // const challenge = await DailyChallenge.getTodaysChallenge(userTimezone);

    // // Get user's current date for response
    // const now = new Date();
    // const userDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
    // const userToday = userDate.toISOString().split('T')[0];

    const userTimezone = req.query.timezone || req.headers['user-timezone'] || 'UTC';

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const userToday = formatter.format(new Date());  // "2025-12-06"
    const challenge = await DailyChallenge.getTodaysChallenge(userTimezone);


    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "No daily challenge available for today",
        date: userToday,
        timezone: userTimezone
      });
    }

    res.json({
      success: true,
      challenge: {
        _id: challenge._id,
        date: challenge.date,
        caseData: challenge.caseData,
        metadata: challenge.metadata,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      },
      userDate: userToday,
      timezone: userTimezone
    });
  } catch (error) {
    next(error);
  }
};

// Get daily challenge by specific date (with timezone validation)
// Premium users can access any past date; non-premium users only today
export const getChallengeByDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const { userId } = req.query;

    // Get user timezone from query parameter or header, default to UTC
    const userTimezone = req.query.timezone || req.headers['user-timezone'] || 'UTC';

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD format"
      });
    }

    // Get today's date in user's timezone
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(new Date());
    const isBackdate = date < todayStr;
    console.log(date, todayStr, isBackdate);

    // Check if user is premium (allows unlimited backdate access)
    let isPremium = false;
    let user = null;
    if (userId) {
      user = await User.findById(userId)
        .select('isPremium completedDailyChallenges')
        .populate({ path: 'completedDailyChallenges.dailyChallenge', select: 'date' })
        .lean();
      if (user?.isPremium) {
        isPremium = true;
      }
    }

    // Check if user already completed this challenge (for ALL users, not just premium)
    // This check must happen BEFORE the premium check so we show "already completed" 
    // instead of "premium required" for challenges they've already played
    if (isBackdate && userId && user) {
      const completedEntry = user?.completedDailyChallenges?.find(
        dc => dc.dailyChallenge?.date === date
      );
      if (completedEntry) {
        // Fetch the challenge data and user's gameplay for insights
        const challenge = await DailyChallenge.findOne({ date }).lean();

        // Find the user's gameplay for this challenge
        const gameplay = await Gameplay.findOne({
          userId: userId,
          dailyChallengeId: challenge?._id,
          sourceType: 'dailyChallenge',
          status: 'completed',
        }).lean();

        return res.status(409).json({
          success: false,
          message: "You have already completed this challenge",
          alreadyCompleted: true,
          requestedDate: date,
          challenge: challenge ? {
            _id: challenge._id,
            date: challenge.date,
            caseData: challenge.caseData,
            metadata: challenge.metadata,
          } : null,
          gameplay: gameplay ? {
            _id: gameplay._id,
            selections: gameplay.selections,
            points: gameplay.points,
            completedAt: gameplay.completedAt,
          } : null,
        });
      }
    }

    // Non-premium users: NO backdate access at all (only reached if not already completed)
    if (isBackdate && !isPremium) {
      return res.status(403).json({
        success: false,
        message: "Backdate access is only available for premium users",
        premiumRequired: true,
        requestedDate: date
      });
    }

    // For premium backdate access, query directly; otherwise use existing method
    let challenge;
    if (isPremium && isBackdate) {
      challenge = await DailyChallenge.findOne({ date });
    } else {
      // For today's date or non-backdate requests, use the model method
      challenge = await DailyChallenge.findOne({ date });
    }

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `No daily challenge available for date: ${date}`,
        date: date,
        timezone: userTimezone
      });
    }

    res.json({
      success: true,
      challenge: {
        _id: challenge._id,
        date: challenge.date,
        caseData: challenge.caseData,
        metadata: challenge.metadata,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      },
      isBackdate: isBackdate,
      isPremiumAccess: isPremium && isBackdate,
      requestedDate: date,
      timezone: userTimezone
    });
  } catch (error) {
    next(error);
  }
};

// Create a new daily challenge (admin function)
export const createDailyChallenge = async (req, res, next) => {
  try {
    const { date, caseData, metadata } = req.body;

    if (!date || !caseData) {
      return res.status(400).json({
        success: false,
        message: "Date and caseData are required"
      });
    }

    // Check if challenge already exists for this date
    const existingChallenge = await DailyChallenge.findOne({ date });
    if (existingChallenge) {
      return res.status(409).json({
        success: false,
        message: `Daily challenge already exists for date: ${date}`
      });
    }

    const challenge = new DailyChallenge({
      date,
      caseData,
      metadata: metadata || {
        difficulty: 'medium',
        category: 'general',
        title: 'Daily Challenge',
        description: ''
      }
    });

    await challenge.save();

    res.status(201).json({
      success: true,
      message: "Daily challenge created successfully",
      challenge: {
        _id: challenge._id,
        date: challenge.date,
        caseData: challenge.caseData,
        metadata: challenge.metadata,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Daily challenge already exists for this date"
      });
    }
    next(error);
  }
};

// Update daily challenge (admin function)
export const updateDailyChallenge = async (req, res, next) => {
  try {
    const { date } = req.params;
    const { caseData, metadata } = req.body;

    const challenge = await DailyChallenge.findOne({ date });
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `No daily challenge found for date: ${date}`
      });
    }

    if (caseData) challenge.caseData = caseData;
    if (metadata) challenge.metadata = { ...challenge.metadata, ...metadata };

    await challenge.save();

    res.json({
      success: true,
      message: "Daily challenge updated successfully",
      challenge: {
        _id: challenge._id,
        date: challenge.date,
        caseData: challenge.caseData,
        metadata: challenge.metadata,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete daily challenge (admin function)
export const deleteDailyChallenge = async (req, res, next) => {
  try {
    const { date } = req.params;

    const challenge = await DailyChallenge.findOneAndDelete({ date });
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `No daily challenge found for date: ${date}`
      });
    }

    res.json({
      success: true,
      message: "Daily challenge deleted successfully",
      deletedChallenge: {
        _id: challenge._id,
        date: challenge.date
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all daily challenges (admin function / past challenges list)
// Supports cursor-based pagination with lastDate for efficient infinite scroll
export const getAllDailyChallenges = async (req, res, next) => {
  try {
    const { limit = 10, lastDate, sort = '-date' } = req.query;

    // Cursor-based filter: get challenges older than lastDate
    const filter = lastDate
      ? { date: { $lt: lastDate } }
      : {};

    const challenges = await DailyChallenge.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .select('date metadata createdAt updatedAt');

    const total = await DailyChallenge.countDocuments();

    // Determine if there are more results
    const lastChallenge = challenges[challenges.length - 1];
    const hasMore = lastChallenge
      ? await DailyChallenge.exists({ date: { $lt: lastChallenge.date } })
      : false;

    res.json({
      success: true,
      challenges,
      pagination: {
        total,
        limit: parseInt(limit),
        lastDate: lastChallenge?.date || null,
        hasMore: !!hasMore
      }
    });
  } catch (error) {
    next(error);
  }
};

// Populate daily challenges from case.json (admin function)
export const populateDailyChallenges = async (req, res, next) => {
  try {
    // Import case data from the JSON file
    const fs = await import('fs');
    const path = await import('path');

    const caseDataPath = path.join(process.cwd(), 'case.json');
    const caseDataRaw = fs.readFileSync(caseDataPath, 'utf8');
    const casesData = JSON.parse(caseDataRaw);

    if (!casesData || !Array.isArray(casesData)) {
      return res.status(400).json({
        success: false,
        message: "case.json not found or invalid format"
      });
    }

    const createdChallenges = [];
    const errors = [];

    // Process each case from the JSON file
    for (let i = 0; i < casesData.length; i++) {
      try {
        const caseItem = casesData[i];
        const caseDate = caseItem.date;
        const caseData = caseItem.case;

        if (!caseDate || !caseData) {
          errors.push({
            index: i,
            error: 'Missing date or case data'
          });
          continue;
        }

        // Check if challenge already exists for this date
        const existingChallenge = await DailyChallenge.findOne({ date: caseDate });
        if (existingChallenge) {
          errors.push({
            date: caseDate,
            caseId: caseData.caseId,
            error: 'Challenge already exists for this date'
          });
          continue;
        }

        // Create metadata from case data
        const metadata = {
          difficulty: 'medium', // Default difficulty
          category: caseData.caseCategory || 'General',
          title: caseData.caseTitle || `Daily Challenge - ${caseData.caseId}`,
          description: `Solve today's case: ${caseData.caseTitle || caseData.caseId}`
        };

        // Create the daily challenge
        const challenge = new DailyChallenge({
          date: caseDate,
          caseData: caseData,
          metadata: metadata
        });

        await challenge.save();
        createdChallenges.push({
          date: caseDate,
          caseId: caseData.caseId,
          title: caseData.caseTitle,
          category: caseData.caseCategory
        });

      } catch (error) {
        errors.push({
          index: i,
          caseId: casesData[i]?.case?.caseId || `Case ${i}`,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Successfully processed ${casesData.length} cases`,
      created: createdChallenges,
      errors: errors,
      summary: {
        totalCases: casesData.length,
        created: createdChallenges.length,
        errors: errors.length,
        startDate: createdChallenges.length > 0 ? createdChallenges[0].date : 'N/A',
        endDate: createdChallenges.length > 0 ? createdChallenges[createdChallenges.length - 1].date : 'N/A'
      }
    });

  } catch (error) {
    next(error);
  }
};
