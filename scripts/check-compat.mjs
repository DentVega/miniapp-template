/**
 * Gate de compatibilidad de la miniapp contra el host contract (skew de shared).
 * Self-contained (semver directo). Rollout-safe: sin contract → skip; incompatible
 * → warn por defecto, exit 1 solo con COMPAT_ENFORCE=1.
 * Uso (en CI): BACKSTAGE_URL=... [COMPAT_ENFORCE=1] node scripts/check-compat.mjs
 */
import semver from "semver";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Compara el manifest.shared de la miniapp contra lo que provee el host. */
export function checkSkew(contractShared, manifestShared) {
  const provided = contractShared ?? {}; // crash-proof si el contract viene malformado
  const incompatible = [];
  for (const dep of manifestShared) {
    const hostVersion = provided[dep.name];
    if (hostVersion === undefined) {
      incompatible.push({ name: dep.name, provided: null, requiredRange: dep.requiredRange });
    } else if (!semver.satisfies(hostVersion, dep.requiredRange, { includePrerelease: false })) {
      incompatible.push({ name: dep.name, provided: hostVersion, requiredRange: dep.requiredRange });
    }
  }
  return { compatible: incompatible.length === 0, incompatible };
}

/** Natives que la miniapp necesita y el host NO provee (set-difference). Crash-proof. */
export function checkNatives(contractNativeModules, manifestNativeModules) {
  const host = new Set(contractNativeModules ?? []);
  return (manifestNativeModules ?? []).filter((m) => !host.has(m));
}

// --- CLI ---
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const baseUrl = process.env.BACKSTAGE_URL;
  const enforce = process.env.COMPAT_ENFORCE === "1";
  if (!baseUrl) { console.error("BACKSTAGE_URL is required"); process.exit(1); }

  let contract = null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/host-contract`);
    if (res.ok) contract = await res.json();
    else console.warn(`check-compat: host contract HTTP ${res.status} — skipping (no gate yet)`);
  } catch (err) {
    console.warn(`check-compat: host contract fetch failed (${err}) — skipping`);
  }
  if (!contract) process.exit(0); // rollout-safe: sin contract, no bloquea

  const manifest = JSON.parse(readFileSync(path.resolve("manifest.json"), "utf8"));
  const skew = checkSkew(contract.shared, manifest.shared ?? []);
  const missingNatives = checkNatives(contract.nativeModules, manifest.nativeModules ?? []);
  const compatible = skew.compatible && missingNatives.length === 0;
  if (compatible) {
    console.log(`check-compat: OK vs host contract v${contract.contractVersion}`);
    process.exit(0);
  }
  const skewDetail = skew.incompatible.map((e) => `${e.name} (host ${e.provided ?? "MISSING"}, needs ${e.requiredRange})`);
  const nativeDetail = missingNatives.map((n) => `${n} (native module not in host)`);
  const detail = [...skewDetail, ...nativeDetail].join("; ");
  const msg = `check-compat: INCOMPATIBLE with host contract v${contract.contractVersion} — ${detail}`;
  if (enforce) { console.error(`${msg}\n[COMPAT_ENFORCE=1 → failing the build]`); process.exit(1); }
  console.warn(`${msg}\n[warn mode — set COMPAT_ENFORCE=1 to block]`);
  process.exit(0);
}
