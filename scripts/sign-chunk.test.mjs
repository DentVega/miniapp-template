import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { generateKeyPairSync, verify, createPublicKey, createHash } from "node:crypto";
import { signChunk } from "./sign-chunk.mjs";

const SPKI = Buffer.from("302a300506032b6570032100", "hex");
const pubObj = (xB64url) =>
  createPublicKey({
    key: Buffer.concat([SPKI, Buffer.from(xB64url, "base64url")]),
    format: "der",
    type: "spki",
  });

test("signChunk firma id:platform:integrity del container extraído del zip", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const priv = privateKey.export({ format: "jwk" }).d;
  const pub = publicKey.export({ format: "jwk" }).x;

  const container = new Uint8Array([10, 20, 30]);
  const zipBytes = zipSync({
    "acc.container.js.bundle": container,
    "vendors.chunk.bundle": new Uint8Array([1]),
  });

  const out = signChunk({ zipBytes, id: "acc", platform: "android", privateKeyB64url: priv });
  const expectedIntegrity = `sha256-${createHash("sha256").update(Buffer.from(container)).digest("hex")}`;
  assert.equal(out.integrity, expectedIntegrity);

  const msg = `acc:android:${expectedIntegrity}`;
  const ok = verify(null, Buffer.from(msg, "utf8"), pubObj(pub), Buffer.from(out.signature, "base64url"));
  assert.equal(ok, true);
});

test("signChunk devuelve null sin clave", () => {
  const zipBytes = zipSync({ "acc.container.js.bundle": new Uint8Array([1]) });
  assert.equal(signChunk({ zipBytes, id: "acc", platform: "android", privateKeyB64url: "" }), null);
});
