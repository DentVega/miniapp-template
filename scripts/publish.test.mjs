import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVer, cmpVer, bumpPatch, nextVersion } from "./version.mjs";

test("parseVer splits into numbers", () => {
  assert.deepEqual(parseVer("0.1.2"), [0, 1, 2]);
});

test("cmpVer orders versions", () => {
  assert.equal(cmpVer("0.2.0", "0.1.9"), 1);
  assert.equal(cmpVer("0.1.0", "0.1.2"), -1);
  assert.equal(cmpVer("0.1.2", "0.1.2"), 0);
});

test("bumpPatch increments the patch", () => {
  assert.equal(bumpPatch("0.7.0"), "0.7.1");
  assert.equal(bumpPatch("0.1.9"), "0.1.10");
});

test("nextVersion: first publish uses manifest version", () => {
  assert.equal(nextVersion(null, "0.1.0"), "0.1.0");
});

test("nextVersion: auto-patches when want <= latest", () => {
  assert.equal(nextVersion("0.1.2", "0.1.0"), "0.1.3");
  assert.equal(nextVersion("0.1.2", "0.1.2"), "0.1.3");
});

test("nextVersion: honors an intentional dev bump (want > latest)", () => {
  assert.equal(nextVersion("0.1.2", "0.2.0"), "0.2.0");
});
