import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSkew } from "../check-compat.mjs";

const contractShared = { "react-native": "0.76.6", react: "18.3.1" };

test("compatible cuando el host satisface el requiredRange", () => {
  const r = checkSkew(contractShared, [
    { name: "react-native", requiredRange: "^0.76.0", singleton: true },
    { name: "react", requiredRange: "^18.3.0", singleton: true },
  ]);
  assert.equal(r.compatible, true);
  assert.deepEqual(r.incompatible, []);
});

test("incompatible cuando el host queda fuera del rango (semver real)", () => {
  const r = checkSkew(contractShared, [
    { name: "react-native", requiredRange: "^0.77.0", singleton: true }, // host 0.76.6 no satisface
  ]);
  assert.equal(r.compatible, false);
  assert.equal(r.incompatible[0].name, "react-native");
});

test("dep que el host NO provee → incompatible (missing)", () => {
  const r = checkSkew(contractShared, [{ name: "react-native-svg", requiredRange: "^15.0.0", singleton: true }]);
  assert.equal(r.compatible, false);
  assert.equal(r.incompatible[0].name, "react-native-svg");
});
