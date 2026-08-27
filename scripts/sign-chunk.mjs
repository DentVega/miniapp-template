/** Firma el chunk para el publish. Extrae `${id}.container.js.bundle` del zip (los MISMOS
 *  bytes que el server hashea), calcula sha256-<hex>, y firma `${id}:${platform}:${integrity}`
 *  con Ed25519. Devuelve null si no hay clave (degradación segura). */
import { unzipSync } from "fflate";
import { createHash, createPrivateKey, sign } from "node:crypto";

const PKCS8_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
function privateKeyObject(seedB64url) {
  const der = Buffer.concat([PKCS8_SEED_PREFIX, Buffer.from(seedB64url, "base64url")]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function signChunk({ zipBytes, id, platform, privateKeyB64url }) {
  if (!privateKeyB64url) return null;
  const files = unzipSync(zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes));
  const container = files[`${id}.container.js.bundle`];
  if (!container) throw new Error(`sign-chunk: falta ${id}.container.js.bundle en el zip`);
  const integrity = `sha256-${createHash("sha256").update(Buffer.from(container)).digest("hex")}`;
  const msg = `${id}:${platform}:${integrity}`;
  const signature = sign(null, Buffer.from(msg, "utf8"), privateKeyObject(privateKeyB64url)).toString(
    "base64url",
  );
  return { integrity, signature };
}
