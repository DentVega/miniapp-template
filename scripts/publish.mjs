#!/usr/bin/env node
/**
 * Publish a built miniapp chunk to Backstage (ADR-016). Reusable across miniapps.
 *
 * Usage: node scripts/publish.mjs <build.zip>
 * Env:   BACKSTAGE_URL, PUBLISH_TOKEN
 * Reads: manifest.json (id, version) + package.json (version fallback)
 *
 * Auto-bump: the registry is immutable, so re-publishing a static version 409s.
 * We read the miniapp's latestVersion from the registry and publish
 * nextVersion(latest, manifest.version) — patch-auto-increment, honoring an
 * intentional minor/major bump in manifest.json. No commit back to the repo.
 *
 * No extra deps — Node provides fetch / FormData / Blob / fs.
 */
import { readFileSync } from "node:fs";
import { nextVersion } from "./version.mjs";

const zipPath = process.argv[2];
if (!zipPath) {
  console.error("usage: node scripts/publish.mjs <build.zip>");
  process.exit(1);
}

const backstageUrl = process.env.BACKSTAGE_URL;
const token = process.env.PUBLISH_TOKEN;
if (!backstageUrl || !token) {
  console.error("BACKSTAGE_URL and PUBLISH_TOKEN must be set");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const id = manifest.id;
const want = manifest.version ?? pkg.version;

// Look up the current latest published version to auto-bump past it.
let latest = null;
try {
  const res = await fetch(`${backstageUrl}/api/miniapps`);
  if (res.ok) {
    const body = await res.json();
    const found = (body.miniapps ?? []).find((m) => m.id === id);
    latest = found?.latestVersion ?? null;
  } else {
    console.warn(`catalog lookup failed: HTTP ${res.status} — falling back to manifest version`);
  }
} catch (err) {
  console.warn(`catalog lookup error (${err instanceof Error ? err.message : err}) — falling back to manifest version`);
}

const version = nextVersion(latest, want);

const form = new FormData();
form.set("file", new Blob([readFileSync(zipPath)]), "build.zip");
form.set("version", String(version));
form.set("manifest", JSON.stringify({ ...manifest, version }));

const res = await fetch(`${backstageUrl}/api/miniapps/${id}/upload`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: form,
});

const body = await res.text();
if (!res.ok) {
  console.error(`publish failed: HTTP ${res.status} ${body}`);
  process.exit(1);
}
console.log(`published ${id}@${version} (latest was ${latest ?? "none"}): ${body}`);
