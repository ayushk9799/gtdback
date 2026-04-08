import Quizz from "../models/Quizz.js";
import QuizzCategory from "../models/QuizzCategory.js";
import QuizzAttempt from "../models/QuizzAttempt.js";
import { deepMerge } from "../utils/deepMerge.js";
import mongoose from "mongoose";

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
        const { userId, lang = "en" } = req.query;

        const categories = await QuizzCategory.find().sort({ quizzCount: -1, name: 1 }).lean();
        
        // Merge category name translations
        const processedCategories = categories.map(cat => {
            const originalName = cat.name;
            let processed = cat;
            if (lang !== "en" && cat.translations?.[lang]) {
                processed = deepMerge(cat, cat.translations[lang]);
            }
            return {
                ...processed,
                originalName: originalName
            };
        });

        if (userId) {
            // Optimization: Fetch all user attempts once (max 2000)
            const userAttempts = await QuizzAttempt.find({ userId }).select("quizzId").lean();
            const attemptedSet = new Set(userAttempts.map(a => a.quizzId.toString()));

            const data = processedCategories.map(cat => {
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
            count: processedCategories.length,
            data: processedCategories,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a preview of the next unsolved quiz for the user
 * GET /api/quizz/next-preview?userId=xxx
 */
export const getNextQuizzPreview = async (req, res, next) => {
    try {
        const { userId } = req.query;

        let query = {};

        // If userId provided, exclude already attempted quizzes
        if (userId) {
            const userAttempts = await QuizzAttempt.find({ userId }).select("quizzId").lean();
            const attemptedIds = userAttempts.map(a => a.quizzId);
            if (attemptedIds.length > 0) {
                query._id = { $nin: attemptedIds };
            }
        }

        const nextQuiz = await Quizz.findOne(query)
            .select("clinicalImages complain department category translations")
            .sort({ createdAt: -1 })
            .populate("category", "name translations")
            .lean();

        if (!nextQuiz) {
            return res.status(200).json({
                success: true,
                data: null,
            });
        }

        const originalCategoryName = nextQuiz.category?.name || null;
        const lang = req.query.lang || "en";
        let translatedData = nextQuiz;
        if (lang !== "en" && nextQuiz.translations?.[lang]) {
            translatedData = deepMerge(nextQuiz, nextQuiz.translations[lang]);
        }
        
        // Also merge category translation if it was populated
        if (lang !== "en" && translatedData.category?.translations?.[lang]) {
            translatedData.category = deepMerge(translatedData.category, translatedData.category.translations[lang]);
        }

        res.status(200).json({
            success: true,
            data: {
                _id: translatedData._id,
                previewImage: translatedData.clinicalImages?.[0] || null,
                complain: translatedData.complain,
                department: translatedData.department,
                categoryName: translatedData.category?.name || null,
                categoryOriginalName: originalCategoryName,
            },
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
                .populate("category", "name translations")
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
            .populate("category", "name translations")
            .lean();

        const lang = req.query.lang || "en";
        const processedQuizzes = quizzes.map(q => {
            let processed = q;
            if (lang !== "en" && q.translations?.[lang]) {
                processed = deepMerge(q, q.translations[lang]);
            }
            // Also merge category translation for listing
            if (lang !== "en" && processed.category?.translations?.[lang]) {
                processed.category = deepMerge(processed.category, processed.category.translations[lang]);
            }
            return processed;
        });

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

            processedQuizzes.forEach(q => {
                q.attempt = attemptMap[q._id.toString()] || null;
            });
        }

        const total = await Quizz.countDocuments(query);
        const hasMore = skip + processedQuizzes.length < total;

        res.status(200).json({
            success: true,
            count: processedQuizzes.length,
            total,
            page: pageNum,
            hasMore,
            data: processedQuizzes,
        });
    } catch (error) {
        next(error);
    }
};
/**
 * Update translation for a single quiz
 * PUT /api/quizz/:id/translations/:lang
 */
export const updateQuizzTranslation = async (req, res, next) => {
    try {
        const { id, lang } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Valid quiz ObjectId required" });
        }
        if (!lang || typeof lang !== "string" || lang.length < 2) {
            return res.status(400).json({ error: "Valid language code required (e.g. 'de')" });
        }
        
        const doc = await Quizz.findById(id);
        if (!doc) return res.status(404).json({ error: "Quizz not found" });
        
        doc.translations.set(lang, req.body);
        await doc.save();
        
        return res.json({ success: true, message: `Translation '${lang}' saved for quiz ${id}` });
    } catch (err) {
        next(err);
    }
};

/**
 * Bulk update quiz translations
 * PUT /api/quizz/translations/bulk
 */
export const bulkUpdateQuizzTranslations = async (req, res, next) => {
    try {
        const { lang, quizzes } = req.body;
        if (!lang || typeof lang !== "string") {
            return res.status(400).json({ error: "'lang' (string) is required" });
        }
        if (!Array.isArray(quizzes) || quizzes.length === 0) {
            return res.status(400).json({ error: "'quizzes' array is required" });
        }
        
        let updated = 0;
        const errors = [];
        for (const item of quizzes) {
            try {
                const quizId = item.quizzId || item._id;
                if (!quizId) { errors.push({ error: "Missing quizzId" }); continue; }
                const doc = await Quizz.findById(quizId);
                if (!doc) { errors.push({ quizzId, error: "Not found" }); continue; }
                doc.translations.set(lang, item.translation);
                await doc.save();
                updated++;
            } catch (e) {
                errors.push({ quizzId: item.quizzId, error: e.message });
            }
        }
        return res.json({ success: true, updated, errors });
    } catch (err) {
        next(err);
    }
};
