import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveShared, parseAutolinkedNatives, deriveMinContractVersion, reactNativeFloor } from "../gen-manifest-shared.mjs";

// contract.shared del host; resolveVersion simula lo instalado en la miniapp.
const contractShared = { react: "18.3.1", "react-native": "0.76.6", zustand: "5.0.14" };

test("deriveShared: ^versión resuelta para cada shared que la miniapp tiene instalado", () => {
  const resolve = (name) => (name === "zustand" ? null : ({ react: "18.3.1", "react-native": "0.76.9" }[name]));
  const out = deriveShared(contractShared, resolve);
  // react + react-native están; zustand NO (resolve → null) → se omite
  assert.deepEqual(out, [
    { name: "react", requiredRange: "^18.3.1", singleton: true },
    { name: "react-native", requiredRange: "^0.76.9", singleton: true },
  ]);
});

test("deriveShared: vacío si la miniapp no comparte nada", () => {
  assert.deepEqual(deriveShared(contractShared, () => null), []);
});

test("deriveShared: contract malformado (shared undefined) NO tira → []", () => {
  assert.deepEqual(deriveShared(undefined, () => "1.0.0"), []);
});

const RN_CONFIG = {
  dependencies: {
    "react-native-svg": { platforms: { android: { sourceDir: "x" }, ios: {} } },
    "react-native-screens": { platforms: { android: {}, ios: null } },
    "some-pure-js-lib": { platforms: { android: null, ios: null } },
  },
};

test("parseAutolinkedNatives: solo deps con native code (android o ios no-null)", () => {
  const out = parseAutolinkedNatives(RN_CONFIG);
  assert.deepEqual(out.sort(), ["react-native-screens", "react-native-svg"]);
});

test("parseAutolinkedNatives: tolera config vacío", () => {
  assert.deepEqual(parseAutolinkedNatives({}), []);
  assert.deepEqual(parseAutolinkedNatives({ dependencies: {} }), []);
});

const SINCE = {
  shared: { react: "0.1.0", "react-native": "0.1.0", "react-native-reanimated": "0.2.0" },
  native: { "react-native-reanimated": "0.2.0", "react-native-mmkv": "0.3.0" },
};

test("deriveMinContractVersion: máximo de los since usados", () => {
  assert.equal(deriveMinContractVersion(["react", "react-native"], [], SINCE), "0.1.0");
  assert.equal(deriveMinContractVersion(["react-native-reanimated"], [], SINCE), "0.2.0");
  assert.equal(deriveMinContractVersion([], ["react-native-mmkv"], SINCE), "0.3.0");
  assert.equal(deriveMinContractVersion(["react"], ["react-native-mmkv"], SINCE), "0.3.0"); // el máximo
});

test("deriveMinContractVersion: ignora lo que no mapea; vacío → 0.0.0", () => {
  assert.equal(deriveMinContractVersion(["no-existe"], [], SINCE), "0.0.0");
});

test("reactNativeFloor: floor del requiredRange (^0.76.6 → 0.76.6)", () => {
  const shared = [{ name: "react-native", requiredRange: "^0.76.6", singleton: true }];
  assert.equal(reactNativeFloor(shared, "9.9.9"), "0.76.6");
});

test("reactNativeFloor: sin react-native → fallback", () => {
  assert.equal(reactNativeFloor([{ name: "react", requiredRange: "^18.0.0" }], "0.76.6"), "0.76.6");
});
