#!/usr/bin/env node
/**
 * Publish a built miniapp chunk to Backstage (ADR-016). Reusable across miniapps.
 *
 * Usage: node scripts/publish.mjs <build.zip>
 * Env:   BACKSTAGE_URL, PUBLISH_TOKEN
 * Reads: manifest.json (id, version, ...) + package.json (version fallback)
 *
 * No extra deps — Node 20 provides fetch / FormData / Blob / fs. The zip is
 * produced by the CI step (`cd build && zip -r ../build.zip .`).
 */
import { readFileSync } from "node:fs";

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
const version = manifest.version ?? pkg.version;

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
console.log(`published ${id}@${version}: ${body}`);
