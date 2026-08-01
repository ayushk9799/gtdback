import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import { makeCaseAccessKey } from "../services/caseAccessService.js";

dotenv.config({ path: "./config/config.env" });

const migrate = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");

  await mongoose.connect(process.env.MONGODB_URI);

  let migrated = 0;
  const users = User.find({}).cursor();

  for await (const user of users) {
    const keys = new Set(user.freeCaseAccessKeys || []);
    for (const item of user.completedCases || []) {
      if (item?.case) keys.add(makeCaseAccessKey("case", item.case));
    }
    for (const item of user.completedDailyChallenges || []) {
      if (item?.dailyChallenge) {
        keys.add(makeCaseAccessKey("dailyChallenge", item.dailyChallenge));
      }
    }

    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { freeCaseAccessKeys: [...keys] },
        $unset: { hearts: "", referralCode: "", appliedReferralCode: "" },
      }
    );
    migrated += 1;
  }

  const referralIndex = (await User.collection.indexes())
    .find((index) => index.name === "referralCode_1");
  if (referralIndex) await User.collection.dropIndex(referralIndex.name);

  console.log(`Migrated ${migrated} users`);
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
