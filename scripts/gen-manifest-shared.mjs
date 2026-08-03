/**
 * Deriva un manifest.shared TRUTHFUL de las deps reales de la miniapp ∩ el host
 * contract, y lo escribe en manifest.json (+ minHostContract). Reemplaza el
 * `shared` hand-written (que podía mentir). Self-contained (no importa el
 * contract package).
 *
 * Rollout-safe: si el contract no está publicado (404/red) → skip, deja el
 * manifest como está. Uso (en CI): BACKSTAGE_URL=... node scripts/gen-manifest-shared.mjs
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";
import semver from "semver";

const require = createRequire(import.meta.url);

/** Para cada shared del host que la miniapp tiene instalado, emite ^versión resuelta. */
export function deriveShared(contractShared, resolveVersion) {
  const out = [];
  for (const name of Object.keys(contractShared ?? {})) {
    const v = resolveVersion(name);
    if (v) out.push({ name, requiredRange: `^${v}`, singleton: true });
  }
  return out;
}

/**
 * El mínimo contractVersion que provee TODAS las capabilities que la miniapp usa
 * (el máximo semver de sus "since"). Ignora lo que no está en el mapa (no es del host).
 * Vacío → "0.0.0" (no usa capabilities del host → cualquier host sirve).
 */
export function deriveMinContractVersion(usedShared, usedNative, capabilitySince) {
  const cs = capabilitySince ?? { shared: {}, native: {} };
  const versions = [
    ...usedShared.map((n) => cs.shared[n]),
    ...usedNative.map((n) => cs.native[n]),
  ].filter(Boolean);
  if (versions.length === 0) return "0.0.0";
  return semver.rsort([...versions])[0];
}

/** Floor del requiredRange de react-native del manifest.shared (opción ii). */
export function reactNativeFloor(sharedEntries, fallback) {
  const rn = sharedEntries.find((s) => s.name === "react-native");
  if (!rn) return fallback;
  const min = semver.minVersion(rn.requiredRange);
  return min ? min.version : fallback;
}

/** Resuelve la versión instalada de un paquete en la miniapp (o null). */
function installedVersion(name) {
  try {
    return require(`${name}/package.json`).version;
  } catch {
    return null;
  }
}

/**
 * Módulos nativos que la miniapp autolinkea (del output de `react-native config`).
 * Un dep es nativo si tiene config de plataforma (android o ios) no-null.
 */
export function parseAutolinkedNatives(rnConfig) {
  const deps = rnConfig?.dependencies ?? {};
  return Object.entries(deps)
    .filter(([, d]) => {
      const p = d?.platforms ?? {};
      return (p.android != null) || (p.ios != null);
    })
    .map(([name]) => name);
}

/** Corre `react-native config` y devuelve los natives autolinkeados (best-effort → []). */
function miniappNativeModules() {
  try {
    const raw = execSync("pnpm exec react-native config", {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000, // un `react-native config` colgado degrada a [] (catch), no traba el CI
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseAutolinkedNatives(JSON.parse(raw));
  } catch (err) {
    console.warn(`gen-manifest-shared: react-native config failed (${err}) — nativeModules: []`);
    return [];
  }
}

// --- CLI ---
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const baseUrl = process.env.BACKSTAGE_URL;
  if (!baseUrl) {
    console.error("BACKSTAGE_URL is required");
    process.exit(1);
  }
  let contract = null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/host-contract`);
    if (res.ok) contract = await res.json();
    else console.warn(`gen-manifest-shared: host contract HTTP ${res.status} — skipping (manifest unchanged)`);
  } catch (err) {
    console.warn(`gen-manifest-shared: host contract fetch failed (${err}) — skipping`);
  }
  if (contract) {
    const manifestPath = path.resolve("manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.shared = deriveShared(contract.shared, installedVersion);
    manifest.nativeModules = miniappNativeModules();
    const usedShared = manifest.shared.map((s) => s.name);
    if (contract.capabilitySince) {
      // Preciso (opción B): el mínimo host que provee lo que la miniapp realmente usa.
      manifest.minHostContract = {
        reactNative: reactNativeFloor(manifest.shared, contract.reactNative),
        contractVersion: deriveMinContractVersion(usedShared, manifest.nativeModules, contract.capabilitySince),
      };
    } else {
      // Rollout-safe: contract viejo sin capabilitySince → conservador (built-against).
      manifest.minHostContract = { reactNative: contract.reactNative, contractVersion: contract.contractVersion };
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`gen-manifest-shared: derived ${manifest.shared.length} shared dep(s) from contract v${contract.contractVersion} + ${manifest.nativeModules.length} native(s)`);
  }
}
