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
    manifest.minHostContract = { reactNative: contract.reactNative, contractVersion: contract.contractVersion };
    manifest.nativeModules = miniappNativeModules();
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`gen-manifest-shared: derived ${manifest.shared.length} shared dep(s) from contract v${contract.contractVersion} + ${manifest.nativeModules.length} native(s)`);
  }
}
