import mongoose from "mongoose";
import Category from "../models/Category.js";
import { deepMerge } from "../utils/deepMerge.js";

// GET /api/users/:userId/progress/department?limit=2
export const getDepartmentProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = Math.max(1, Math.min(5, Number(req.query.limit) || 2));

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const { categoryId } = req.query;

    const pipeline = [];

    // If categoryId is provided, filter by it
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      pipeline.push({ $match: { _id: new mongoose.Types.ObjectId(categoryId) } });
    }

    pipeline.push(
      // Ensure arrays exist
      { $addFields: { caseList: { $ifNull: ["$caseList", []] } } },
      // Lookup completed gameplays for this user within this category's case list
      {
        $lookup: {
          from: "gameplays",
          let: { caseIds: "$caseList" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", userObjectId] },
                    { $in: ["$caseId", "$$caseIds"] },
                    { $eq: ["$status", "completed"] },
                  ],
                },
              },
            },
            { $project: { caseId: 1 } },
          ],
          as: "completedGameplays",
        },
      },
      // Compute counts and completed case ids
      {
        $addFields: {
          totalCount: { $ifNull: ["$caseCount", { $size: "$caseList" }] },
          completedCount: { $size: "$completedGameplays" },
          completedCaseIds: {
            $map: { input: "$completedGameplays", as: "g", in: "$$g.caseId" },
          },
        },
      }
    );

    if (categoryId) {
      // For a specific category, we want ALL cases with their status
      pipeline.push(
        {
          $lookup: {
            from: "cases",
            let: { ids: "$caseList", completedIds: "$completedCaseIds" },
            pipeline: [
              { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
              {
                $addFields: {
                  status: {
                    $cond: [
                      { $in: ["$_id", "$$completedIds"] },
                      "completed",
                      "unsolved"
                    ]
                  }
                }
              },
              { $project: { caseData: 1, translations: 1, status: 1 } },
            ],
            as: "allCasesRaw",
          },
        },
        {
          $project: {
            categoryId: "$_id",
            name: "$name",
            translations: 1,
            totalCount: 1,
            completedCount: 1,
            cases: {
              $map: {
                input: "$allCasesRaw",
                as: "c",
                in: {
                  caseId: "$$c._id",
                  status: "$$c.status",
                  translations: "$$c.translations",
                  caseTitle: { $ifNull: ["$$c.caseData.caseTitle", ""] },
                  chiefComplaint: {
                    $ifNull: [
                      {
                        $getField: {
                          field: "chiefComplaint",
                          input: {
                            $getField: {
                              field: "data",
                              input: { $arrayElemAt: ["$$c.caseData.steps", 0] },
                            },
                          },
                        },
                      },
                      { $ifNull: ["$$c.caseData.caseTitle", ""] },
                    ],
                  },
                  mainimage: { $ifNull: ["$$c.caseData.mainimage", null] },
                },
              },
            },
          },
        }
      );
    } else {
      // Default behavior: return unsolved boxes for Home screen
      pipeline.push(
        {
          $addFields: {
            unsolvedCaseIds: {
              $filter: {
                input: "$caseList",
                as: "id",
                cond: { $not: { $in: ["$$id", "$completedCaseIds"] } }
              }
            }
          },
        },
        {
          $addFields: {
            unsolvedLimited: { $slice: ["$unsolvedCaseIds", limit] },
          },
        },
        // Lookup case data for unsolved
        {
          $lookup: {
            from: "cases",
            let: { ids: "$unsolvedLimited" },
            pipeline: [
              { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
              { $project: { caseData: 1, translations: 1 } },
            ],
            as: "unsolvedCasesRaw",
          },
        },
        {
          $project: {
            categoryId: "$_id",
            name: "$name",
            translations: 1,
            totalCount: 1,
            completedCount: 1,
            unsolvedCases: {
              $map: {
                input: "$unsolvedCasesRaw",
                as: "c",
                in: {
                  caseId: "$$c._id",
                  translations: "$$c.translations",
                  originalIndex: { $indexOfArray: ["$caseList", "$$c._id"] },
                  caseTitle: { $ifNull: ["$$c.caseData.caseTitle", ""] },
                  chiefComplaint: {
                    $ifNull: [
                      {
                        $getField: {
                          field: "chiefComplaint",
                          input: {
                            $getField: {
                              field: "data",
                              input: { $arrayElemAt: ["$$c.caseData.steps", 0] },
                            },
                          },
                        },
                      },
                      { $ifNull: ["$$c.caseData.caseTitle", ""] },
                    ],
                  },
                  mainimage: { $ifNull: ["$$c.caseData.mainimage", null] },
                },
              },
            },
          },
        },
        { $sort: { name: 1 } }
      );
    }

    const rawDepartments = await Category.aggregate(pipeline);
    const { lang = "en" } = req.query;

    const departments = rawDepartments.map(dept => {
      let processedDept = { ...dept };
      
      // 1. Merge category name translation
      if (lang !== "en" && dept.translations?.[lang]) {
        processedDept = deepMerge(processedDept, dept.translations[lang]);
      }

      // 2. Merge case translations (for lists)
      const mergeCaseTranslation = (c) => {
        let p = { ...c };
        if (lang !== "en" && c.translations?.[lang]) {
          const t = c.translations[lang];
          if (t.caseTitle) p.caseTitle = t.caseTitle;
          // Look for chiefComplaint in steps[0].data
          const chief = t.steps?.[0]?.data?.chiefComplaint;
          if (chief) p.chiefComplaint = chief;
        }
        delete p.translations; // Remove unwanted field from response
        return p;
      };

      if (processedDept.cases) {
        processedDept.cases = processedDept.cases.map(mergeCaseTranslation);
      }
      if (processedDept.unsolvedCases) {
        processedDept.unsolvedCases = processedDept.unsolvedCases.map(mergeCaseTranslation);
      }

      delete processedDept.translations;
      return processedDept;
    });

    return res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
};


