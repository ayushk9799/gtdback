import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CASE_LIMIT,
  canGrantCaseAccess,
  getHistoricalAccessKeys,
  getLegacyHearts,
  makeCaseAccessKey,
  withLegacyHearts,
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

test("legacy hearts expose two available cases for a new free user", () => {
  assert.equal(getLegacyHearts({
    isPremium: false,
    freeCaseAccessKeys: [],
    completedCases: [],
    completedDailyChallenges: [],
  }), 2);
});

test("legacy hearts count existing users' historical cases without duplicates", () => {
  const caseId = { toString: () => "case-id" };
  assert.equal(getLegacyHearts({
    isPremium: false,
    freeCaseAccessKeys: [makeCaseAccessKey("case", caseId)],
    completedCases: [{ case: caseId }],
    completedDailyChallenges: [],
  }), 1);
});

test("legacy hearts reach zero after two regular or daily cases", () => {
  assert.equal(getLegacyHearts({
    isPremium: false,
    freeCaseAccessKeys: ["case:first"],
    completedCases: [],
    completedDailyChallenges: [{ dailyChallenge: "second" }],
  }), 0);
});

test("legacy hearts never become negative for established users", () => {
  assert.equal(getLegacyHearts({
    isPremium: false,
    freeCaseAccessKeys: ["case:first", "case:second", "case:third"],
  }), 0);
});

test("legacy hearts remain unlimited for premium users", () => {
  assert.equal(getLegacyHearts({
    isPremium: true,
    freeCaseAccessKeys: ["case:first", "case:second", "case:third"],
  }), 100);
});

test("legacy hearts are added to user responses without mutating the source", () => {
  const user = {
    _id: "user-id",
    isPremium: false,
    freeCaseAccessKeys: ["case:first"],
  };
  const response = withLegacyHearts(user);

  assert.equal(response.hearts, 1);
  assert.equal(user.hearts, undefined);
});
