import mongoose from "mongoose";
import Category from "../models/Category.js";

// GET /api/users/:userId/progress/department?limit=2
export const getDepartmentProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = Math.max(1, Math.min(5, Number(req.query.limit) || 2));

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const departments = await Category.aggregate([
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
      // Compute counts and unsolved case ids
      {
        $addFields: {
          totalCount: { $ifNull: ["$caseCount", { $size: "$caseList" }] },
          completedCount: { $size: "$completedGameplays" },
          completedCaseIds: {
            $map: { input: "$completedGameplays", as: "g", in: "$$g.caseId" },
          },
        },
      },
      {
        $addFields: {
          unsolvedCaseIds: { $setDifference: ["$caseList", "$completedCaseIds"] },
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
            { $project: { caseData: 1 } },
          ],
          as: "unsolvedCasesRaw",
        },
      },
      // Project final shape
      {
        $project: {
          categoryId: "$_id",
          name: "$name",
          totalCount: 1,
          completedCount: 1,
          unsolvedCases: {
            $map: {
              input: "$unsolvedCasesRaw",
              as: "c",
              in: {
                caseId: "$$c._id",
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
              },
            },
          },
        },
      },
      { $sort: { name: 1 } },
    ]);

    return res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
};


