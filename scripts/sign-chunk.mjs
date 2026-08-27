/** Firma el chunk para el publish. Lee el container YA EMITIDO en disco
 *  (`build/generated/<platform>/<id>.container.js.bundle`) — los MISMOS bytes que van al zip
 *  y que el server hashea — calcula sha256-<hex>, y firma `${id}:${platform}:${integrity}`.
 *
 *  Solo builtins de Node (fs + crypto): los `scripts/*.mjs` del template NO pueden traer deps,
 *  porque `package.json` es miniapp-owned (`.templatesyncignore`) y las deps no propagan.
 *  Devuelve null si no hay clave (degradación segura). */
import { readFileSync } from "node:fs";
import { createHash, createPrivateKey, sign } from "node:crypto";

const PKCS8_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
function privateKeyObject(seedB64url) {
  const der = Buffer.concat([PKCS8_SEED_PREFIX, Buffer.from(seedB64url, "base64url")]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function signChunk({ containerPath, id, platform, privateKeyB64url }) {
  if (!privateKeyB64url) return null;
  const bytes = readFileSync(containerPath);
  const integrity = `sha256-${createHash("sha256").update(bytes).digest("hex")}`;
  const msg = `${id}:${platform}:${integrity}`;
  const signature = sign(null, Buffer.from(msg, "utf8"), privateKeyObject(privateKeyB64url)).toString(
    "base64url",
  );
  return { integrity, signature };
}
