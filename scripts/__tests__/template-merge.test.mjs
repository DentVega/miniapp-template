import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { templateMerge } from "../template-merge.mjs";

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function g(cwd, ...args) { return execFileSync("git", args, { cwd, encoding: "utf8" }).trim(); }
function write(cwd, rel, content) {
  const f = path.join(cwd, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, content, "utf8");
}
function showOnBranch(cwd, branch, rel) { return g(cwd, "show", `${branch}:${rel}`); }
function existsOnBranch(cwd, branch, rel) {
  try { g(cwd, "cat-file", "-e", `${branch}:${rel}`); return true; } catch { return false; }
}

/** Repo con T0(base) → branch tmpl(template) y branch main(miniapp). */
function setupFixture({ miniapp, template, ignore = "manifest.json\n.template-sync\n" }) {
  const cwd = mkdtempSync(path.join(tmpdir(), "tmerge-"));
  dirs.push(cwd);
  g(cwd, "init", "-q", "-b", "main");
  g(cwd, "config", "user.email", "t@t.co");
  g(cwd, "config", "user.name", "t");
  write(cwd, "src/Screen.tsx", "// base screen\n");
  write(cwd, "shared.txt", "base\n");
  write(cwd, "manifest.json", '{"id":"__MINIAPP_ID__"}\n');
  write(cwd, ".templatesyncignore", ignore);
  g(cwd, "add", "-A"); g(cwd, "commit", "-qm", "T0");
  const base = g(cwd, "rev-parse", "HEAD");
  g(cwd, "switch", "-qc", "tmpl");
  template(cwd);
  g(cwd, "add", "-A"); g(cwd, "commit", "-qm", "template changes");
  const templateHead = g(cwd, "rev-parse", "HEAD");
  g(cwd, "switch", "-q", "main");
  write(cwd, ".template-sync", `${JSON.stringify({ templateRepo: "DentVega/miniapp-template", baseSha: base }, null, 2)}\n`);
  miniapp(cwd);
  g(cwd, "add", "-A"); g(cwd, "commit", "-qm", "miniapp changes");
  return { cwd, base, templateHead };
}

test("no-op: base == templateHead → unchanged (sin tocar git)", () => {
  const res = templateMerge({ base: "sha1", templateHead: "sha1", cwd: "/nonexistent" });
  assert.equal(res.status, "unchanged");
  assert.equal(res.branch, undefined);
});

test("merge limpio: combina ambos lados + bump del marker", () => {
  const { cwd, base, templateHead } = setupFixture({
    template: (c) => write(c, "shared.txt", "base\ntemplate-added\n"),
    miniapp: (c) => write(c, "src/Screen.tsx", "// miniapp custom\n"),
  });
  const res = templateMerge({ base, templateHead, cwd });
  assert.equal(res.status, "merged");
  assert.equal(res.conflicted, false);
  assert.equal(showOnBranch(cwd, res.branch, "shared.txt"), "base\ntemplate-added");
  assert.equal(showOnBranch(cwd, res.branch, "src/Screen.tsx"), "// miniapp custom");
  assert.equal(JSON.parse(showOnBranch(cwd, res.branch, ".template-sync")).baseSha, templateHead);
});

test("conflicto: marcadores <<<<<<< y conflicted=true", () => {
  const { cwd, base, templateHead } = setupFixture({
    template: (c) => write(c, "shared.txt", "base\nTEMPLATE version\n"),
    miniapp: (c) => write(c, "shared.txt", "base\nMINIAPP version\n"),
  });
  const res = templateMerge({ base, templateHead, cwd });
  assert.equal(res.status, "merged");
  assert.equal(res.conflicted, true);
  assert.match(showOnBranch(cwd, res.branch, "shared.txt"), /<<<<<<</);
});

test("ignore-list: preserva la versión de la miniapp de un archivo protegido", () => {
  const { cwd, base, templateHead } = setupFixture({
    template: (c) => write(c, "manifest.json", '{"id":"TEMPLATE"}\n'),
    miniapp: () => {},
  });
  const res = templateMerge({ base, templateHead, cwd });
  assert.equal(JSON.parse(showOnBranch(cwd, res.branch, "manifest.json")).id, "__MINIAPP_ID__");
});

test("ignore-list: borra un archivo protegido que creó el template", () => {
  const { cwd, base, templateHead } = setupFixture({
    ignore: "manifest.json\n.template-sync\nsecret.local\n",
    template: (c) => write(c, "secret.local", "from template\n"),
    miniapp: () => {},
  });
  const res = templateMerge({ base, templateHead, cwd });
  assert.equal(existsOnBranch(cwd, res.branch, "secret.local"), false);
});
