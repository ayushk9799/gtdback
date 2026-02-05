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
    "tox": "toxicology",
    "rheum": "rheumatology",
    "hem": "hematology",
    "onc": "oncology",
    "id": "infectious disease",
    "neuro": "neurology",
    "nepho": "nephrology",
    "gastro": "gastroenterology",
    "pulmo": "pulmonology",
    "ortho": "orthopedics",
    "ent": "otolaryngology (ent)",
    "ophth": "ophthalmology",
    "endo": "endocrinology",
    "obgyn": "obstetrics & gynecology (ob/gyn)",
    "psych": "psychiatry",
    "cardio": "cardiology",
    "derm": "dermatology",
    "em": "emergency medicine",
    "peds": "pediatrics",
    "gen": "genetics"
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
        const { category, page = 1, limit = 10, userId, excludeAttempted } = req.query;
        let query = {};

        if (category && category !== 'null') {
            query.category = category;
        }

        // Scalability Optimization: If excludeAttempted is true, fetch user's attempts first
        if (excludeAttempted === 'true' && userId) {
            const userAttempts = await QuizzAttempt.find({ userId }).select("quizzId").lean();
            const attemptedIds = userAttempts.map(a => a.quizzId);
            if (attemptedIds.length > 0) {
                query._id = { $nin: attemptedIds };
            }
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        const quizzes = await Quizz.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("category", "name");

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
