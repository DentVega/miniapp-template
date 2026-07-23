/** Pure semver helpers for auto-bump (no side effects). Versions are simple x.y.z. */

/** "0.1.2" -> [0,1,2] */
export function parseVer(v) {
  return String(v).split(".").map(Number);
}

/** -1 | 0 | 1 */
export function cmpVer(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** "0.1.2" -> "0.1.3" */
export function bumpPatch(v) {
  const [maj, min, pat] = parseVer(v);
  return `${maj}.${min}.${(pat ?? 0) + 1}`;
}

/**
 * The version to publish. `latest` is the registry's latestVersion (or null),
 * `want` is manifest.version. First publish → want; an intentional dev bump
 * (want > latest) → want; otherwise auto-increment the patch of latest.
 */
export function nextVersion(latest, want) {
  if (latest == null) return want;
  if (cmpVer(want, latest) > 0) return want;
  return bumpPatch(latest);
}
