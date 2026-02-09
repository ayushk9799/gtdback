import Quizz from "../models/Quizz.js";
import QuizzCategory from "../models/QuizzCategory.js";
import QuizzAttempt from "../models/QuizzAttempt.js";

/**
 * Submit a quiz attempt
 * POST /api/quizz/attempt
 */
export const submitQuizzAttempt = async (req, res, next) => {
    try {
        const { userId, quizzId, selectedOption, isCorrect } = req.body;

        if (!userId || !quizzId || selectedOption === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        const attempt = await QuizzAttempt.findOneAndUpdate(
            { userId, quizzId },
            { selectedOption, isCorrect, timestamp: new Date() },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            data: attempt,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk create quiz categories
 * POST /api/quizz/category/bulk
 */
export const bulkCreateQuizzCategories = async (req, res, next) => {
    try {
        const { categories } = req.body;

        if (!Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of categories",
            });
        }

        const createdCategories = await QuizzCategory.insertMany(
            categories.map((name) => ({ name })),
            { ordered: false } // Continue even if some fail (e.g., duplicates)
        );

        res.status(201).json({
            success: true,
            count: createdCategories.length,
            data: createdCategories,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(201).json({
                success: true,
                message: "Bulk upload completed with some duplicates ignored",
            });
        }
        next(error);
    }
};

/**
 * Get all quiz categories with progress
 * GET /api/quizz/category?userId=xxx
 */
export const getAllQuizzCategories = async (req, res, next) => {
    try {
        const { userId } = req.query;

        const categories = await QuizzCategory.find().sort({ name: 1 }).lean();

        if (userId) {
            // Optimization: Fetch all user attempts once (max 2000)
            const userAttempts = await QuizzAttempt.find({ userId }).select("quizzId").lean();
            const attemptedSet = new Set(userAttempts.map(a => a.quizzId.toString()));

            const data = categories.map(cat => {
                const attemptedCount = cat.quizzList.filter(id => attemptedSet.has(id.toString())).length;
                return {
                    ...cat,
                    attemptedCount
                };
            });

            return res.status(200).json({
                success: true,
                count: data.length,
                data
            });
        }

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
};

const DEPARTMENT_MAPPING = {
    // Internal Medicine
    "tox": "internal medicine",
    "rheum": "internal medicine",
    "hem": "internal medicine",
    "onc": "internal medicine",
    "id": "internal medicine",
    "nepho": "internal medicine",
    "gastro": "internal medicine",
    "endo": "internal medicine",
    "gen": "internal medicine",
    "med": "internal medicine",

    // Others
    "surg": "general surgery",
    "em": "emergency medicine",
    "peds": "pediatrics",
    "obgyn": "obstetrics & gynecology",
    "ortho": "orthopedics",
    "cardio": "cardiology",
    "neuro": "neurology",
    "pulmo": "pulmonology",
    "derm": "dermatology",
    "ent": "otolaryngology",
    "ophth": "ophthalmology",
    "psych": "psychiatry"
};

/**
 * Bulk upload quizzes
 * POST /api/quizz/bulk
 */
export const bulkUploadQuizzes = async (req, res, next) => {
    try {
        const { quizzes } = req.body;

        if (!Array.isArray(quizzes) || quizzes.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of quizzes",
            });
        }

        // Pre-fetch categories for fallback name-based lookups
        const allCategories = await QuizzCategory.find({});
        const nameToIdMap = {};
        allCategories.forEach(cat => {
            nameToIdMap[cat.name.toLowerCase().trim()] = cat._id;
        });

        // Normalize quizzes: resolve short names or link by department name
        const normalizedQuizzes = quizzes.map(q => {
            let categoryName = q.department || q.category;

            // If it's a short name, resolve it to the full name
            if (typeof categoryName === 'string') {
                const normalizedShortName = categoryName.toLowerCase().trim();
                const fullName = DEPARTMENT_MAPPING[normalizedShortName] || normalizedShortName;

                // Try to find the category ID by name
                const catId = nameToIdMap[fullName];
                if (catId) {
                    return { ...q, category: catId, department: fullName };
                }
            }
            return q;
        });

        const createdQuizzes = await Quizz.insertMany(normalizedQuizzes);

        // Group quiz IDs by category to update counts
        const categoryMap = {};
        createdQuizzes.forEach(q => {
            if (q.category) {
                const cid = q.category.toString();
                if (!categoryMap[cid]) categoryMap[cid] = [];
                categoryMap[cid].push(q._id);
            }
        });

        // Update each category's quizzList
        for (const catId of Object.keys(categoryMap)) {
            const category = await QuizzCategory.findById(catId);
            if (category) {
                categoryMap[catId].forEach(quizId => {
                    const exists = category.quizzList.some(id => id.toString() === quizId.toString());
                    if (!exists) {
                        category.quizzList.push(quizId);
                    }
                });
                await category.save(); // Triggers pre-save hook to update quizzCount
            }
        }

        res.status(201).json({
            success: true,
            count: createdQuizzes.length,
            data: createdQuizzes,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all quizzes with pagination and "fresh" filter
 * GET /api/quizz?category=xxx&page=1&limit=10&userId=xxx&excludeAttempted=true
 */
export const getAllQuizzes = async (req, res, next) => {
    try {
        const { category, page = 1, limit = 10, userId, excludeAttempted, onlyAttempted } = req.query;
        let query = {};

        if (category && category !== 'null') {
            query.category = category;
        }

        const isExcluding = excludeAttempted === 'true';
        const isOnlyAttempted = onlyAttempted === 'true';

        // Scalability Optimization: If excludeAttempted is true, fetch user's attempts first
        if (isExcluding && userId) {
            const userAttempts = await QuizzAttempt.find({ userId }).select("quizzId").lean();
            const attemptedIds = userAttempts.map(a => a.quizzId);
            if (attemptedIds.length > 0) {
                query._id = { $nin: attemptedIds };
            }
        }

        // NEW: If onlyAttempted is true, fetch only quizzes the user has attempted
        // Use pagination on ATTEMPTS first, then fetch corresponding quizzes
        if (isOnlyAttempted && userId) {
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const skip = (pageNum - 1) * limitNum;

            // Get total count of attempts for this user (with category filter if needed)
            let attemptQuery = { userId };

            // If category filter exists, we need to find quizzes in that category first
            let categoryQuizIds = null;
            if (category && category !== 'null') {
                const categoryQuizzes = await Quizz.find({ category }).select("_id").lean();
                categoryQuizIds = categoryQuizzes.map(q => q._id);
                attemptQuery.quizzId = { $in: categoryQuizIds };
            }

            const totalAttempts = await QuizzAttempt.countDocuments(attemptQuery);

            // Fetch only the paginated attempts (most recent first)
            const paginatedAttempts = await QuizzAttempt.find(attemptQuery)
                .select("quizzId timestamp selectedOption isCorrect")
                .sort({ timestamp: -1 }) // Most recent first
                .skip(skip)
                .limit(limitNum)
                .lean();

            if (paginatedAttempts.length === 0) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    total: totalAttempts,
                    page: pageNum,
                    hasMore: false,
                    data: [],
                });
            }

            const attemptedIds = paginatedAttempts.map(a => a.quizzId);

            // Fetch the corresponding quizzes
            const quizzes = await Quizz.find({ _id: { $in: attemptedIds } })
                .populate("category", "name")
                .lean();

            // Create a map for quick lookup and attach attempt info
            const attemptMap = {};
            paginatedAttempts.forEach(a => {
                attemptMap[a.quizzId.toString()] = {
                    selectedOption: a.selectedOption,
                    isCorrect: a.isCorrect,
                    timestamp: a.timestamp
                };
            });

            // Sort quizzes to match the attempt order (most recent first)
            const orderedQuizzes = attemptedIds.map(id => {
                const quiz = quizzes.find(q => q._id.toString() === id.toString());
                if (quiz) {
                    quiz.attempt = attemptMap[id.toString()];
                }
                return quiz;
            }).filter(Boolean);

            const hasMore = skip + orderedQuizzes.length < totalAttempts;

            return res.status(200).json({
                success: true,
                count: orderedQuizzes.length,
                total: totalAttempts,
                page: pageNum,
                hasMore,
                data: orderedQuizzes,
            });
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        const quizzes = await Quizz.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("category", "name")
            .lean();

        // If not excluding, and userId is provided, attach attempt info
        if (!isExcluding && userId && quizzes.length > 0) {
            const quizIds = quizzes.map(q => q._id);
            const userAttempts = await QuizzAttempt.find({
                userId,
                quizzId: { $in: quizIds }
            }).lean();

            const attemptMap = {};
            userAttempts.forEach(a => {
                attemptMap[a.quizzId.toString()] = {
                    selectedOption: a.selectedOption,
                    isCorrect: a.isCorrect,
                    timestamp: a.timestamp
                };
            });

            quizzes.forEach(q => {
                q.attempt = attemptMap[q._id.toString()] || null;
            });
        }

        const total = await Quizz.countDocuments(query);
        const hasMore = skip + quizzes.length < total;

        res.status(200).json({
            success: true,
            count: quizzes.length,
            total,
            page: pageNum,
            hasMore,
            data: quizzes,
        });
    } catch (error) {
        next(error);
    }
};
