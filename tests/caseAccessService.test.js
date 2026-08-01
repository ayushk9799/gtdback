import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CASE_LIMIT,
  canGrantCaseAccess,
  getHistoricalAccessKeys,
  makeCaseAccessKey,
} from "../services/caseAccessService.js";

test("free users can access their first and second distinct cases", () => {
  assert.equal(canGrantCaseAccess({
    isPremium: false,
    accessKeys: [],
    accessKey: "case:first",
  }), true);
  assert.equal(canGrantCaseAccess({
    isPremium: false,
    accessKeys: ["case:first"],
    accessKey: "dailyChallenge:second",
  }), true);
});

test("regular and daily cases share the same two-case limit", () => {
  assert.equal(FREE_CASE_LIMIT, 2);
  assert.equal(canGrantCaseAccess({
    isPremium: false,
    accessKeys: ["case:first", "dailyChallenge:second"],
    accessKey: "case:third",
  }), false);
});

test("replays remain available after the free limit is reached", () => {
  assert.equal(canGrantCaseAccess({
    isPremium: false,
    accessKeys: ["case:first", "dailyChallenge:second"],
    accessKey: "case:first",
  }), true);
});

test("premium users bypass the free-case limit", () => {
  assert.equal(canGrantCaseAccess({
    isPremium: true,
    accessKeys: ["case:first", "dailyChallenge:second"],
    accessKey: "case:third",
  }), true);
});

test("historical regular and daily completions are deduplicated", () => {
  const caseId = { toString: () => "case-id" };
  const dailyId = { toString: () => "daily-id" };
  const keys = getHistoricalAccessKeys({
    freeCaseAccessKeys: [makeCaseAccessKey("case", caseId)],
    completedCases: [{ case: caseId }],
    completedDailyChallenges: [{ dailyChallenge: dailyId }],
  });

  assert.deepEqual(keys.sort(), ["case:case-id", "dailyChallenge:daily-id"]);
});
