import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, verify, createPublicKey, createHash } from "node:crypto";
import { signChunk } from "./sign-chunk.mjs";

const SPKI = Buffer.from("302a300506032b6570032100", "hex");
const pubObj = (xB64url) =>
  createPublicKey({
    key: Buffer.concat([SPKI, Buffer.from(xB64url, "base64url")]),
    format: "der",
    type: "spki",
  });

test("signChunk firma id:platform:integrity del container en disco", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const priv = privateKey.export({ format: "jwk" }).d;
  const pub = publicKey.export({ format: "jwk" }).x;

  const dir = mkdtempSync(join(tmpdir(), "signchunk-"));
  const containerPath = join(dir, "acc.container.js.bundle");
  const bytes = Buffer.from([10, 20, 30]);
  writeFileSync(containerPath, bytes);

  const out = signChunk({ containerPath, id: "acc", platform: "android", privateKeyB64url: priv });
  const expectedIntegrity = `sha256-${createHash("sha256").update(bytes).digest("hex")}`;
  assert.equal(out.integrity, expectedIntegrity);

  const msg = `acc:android:${expectedIntegrity}`;
  const ok = verify(null, Buffer.from(msg, "utf8"), pubObj(pub), Buffer.from(out.signature, "base64url"));
  assert.equal(ok, true);
});

test("signChunk devuelve null sin clave (no lee el disco)", () => {
  assert.equal(
    signChunk({ containerPath: "/nonexistent", id: "acc", platform: "android", privateKeyB64url: "" }),
    null,
  );
});
