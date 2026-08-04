/**
 * Núcleo determinístico del 3-way merge de Capa 2 (template-sync), sin red.
 * Extraído de template-sync.yml para testearlo (node:test). Asume: cwd = repo git
 * con HEAD = main de la miniapp y `templateHead` en el object DB (fetcheado).
 * git user.name/email configurados. NO pushea ni abre PR — eso lo hace el workflow.
 * Requiere git >= 2.38 (merge-tree --write-tree).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}
function gitAllowFail(cwd, args) {
  try {
    const stdout = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { stdout, code: 0 };
  } catch (err) {
    return { stdout: err.stdout?.toString() ?? "", code: err.status ?? 1 };
  }
}

/** Restaura la versión de la miniapp de cada path protegido, o lo borra si lo creó el template. */
export function applyIgnoreList(cwd) {
  const file = path.join(cwd, ".templatesyncignore");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const restored = gitAllowFail(cwd, ["checkout", "HEAD", "--", line]);
    if (restored.code !== 0) gitAllowFail(cwd, ["rm", "-f", "--ignore-unmatch", "--", line]);
  }
}

/** Bumpea .template-sync.baseSha al templateHead recién sincronizado. */
export function bumpMarker(cwd, templateHead) {
  const file = path.join(cwd, ".template-sync");
  const marker = JSON.parse(readFileSync(file, "utf8"));
  marker.baseSha = templateHead;
  writeFileSync(file, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

/** @returns {{status:"unchanged"|"no-changes"|"merged", branch?:string, short?:string, conflicted?:boolean}} */
export function templateMerge({ base, templateHead, cwd = process.cwd() }) {
  if (base === templateHead) return { status: "unchanged" };

  const short = git(cwd, ["rev-parse", "--short", templateHead]).trim();
  const branch = `sync/template-${short}`;

  const merge = gitAllowFail(cwd, ["merge-tree", "--write-tree", `--merge-base=${base}`, "HEAD", templateHead]);
  const tree = merge.stdout.split("\n")[0].trim();
  const conflicted = merge.code !== 0;

  git(cwd, ["switch", "-c", branch]);
  git(cwd, ["read-tree", "-u", "--reset", tree]);

  applyIgnoreList(cwd);
  bumpMarker(cwd, templateHead);

  git(cwd, ["add", "-A"]);
  const hasChanges = gitAllowFail(cwd, ["diff", "--cached", "--quiet"]).code !== 0;
  if (!hasChanges) return { status: "no-changes", branch, short, conflicted };

  git(cwd, ["commit", "-m", `sync: template @ ${short}`]);
  return { status: "merged", branch, short, conflicted };
}

// --- CLI: BASE/TEMPLATE_HEAD de env → outputs a $GITHUB_OUTPUT ---
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const base = process.env.BASE, templateHead = process.env.TEMPLATE_HEAD;
  if (!base || !templateHead) { console.error("BASE and TEMPLATE_HEAD are required"); process.exit(1); }
  const res = templateMerge({ base, templateHead });
  console.log(`template-merge: ${res.status}${res.branch ? ` (${res.branch}, conflicted=${res.conflicted})` : ""}`);
  if (process.env.GITHUB_OUTPUT) {
    const lines = [`status=${res.status}`];
    if (res.branch) lines.push(`branch=${res.branch}`, `short=${res.short}`, `conflicted=${res.conflicted}`);
    writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, { flag: "a" });
  }
}
