import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSkew, checkNatives } from "../check-compat.mjs";

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

test("contract malformado (shared undefined) NO tira — trata todo como missing", () => {
  const r = checkSkew(undefined, [{ name: "react", requiredRange: "^18.3.0", singleton: true }]);
  assert.equal(r.compatible, false);
  assert.equal(r.incompatible[0].provided, null);
});

const hostNatives = ["react-native-screens", "react-native-safe-area-context"];

test("checkNatives: [] cuando todos los natives de la miniapp están en el host", () => {
  assert.deepEqual(checkNatives(hostNatives, ["react-native-screens"]), []);
});

test("checkNatives: lista los natives faltantes", () => {
  assert.deepEqual(checkNatives(hostNatives, ["react-native-screens", "react-native-svg"]), ["react-native-svg"]);
});

test("checkNatives: crash-proof si contractNatives viene undefined", () => {
  assert.deepEqual(checkNatives(undefined, ["react-native-svg"]), ["react-native-svg"]);
});
