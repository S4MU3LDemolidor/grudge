#!/usr/bin/env node
// Packs the parts of pixelfx that Grudge uses into one small script inside index.html, so the game stays a
// single file with nothing to install. Only needed when you change which effects the game uses.
//
//   git clone https://github.com/patch-gg/pixelfx ../pixelfx      (once, next to this repo)
//   node tools/build-fx.mjs [path/to/pixelfx]
//
// Needs Deno (https://deno.com) for `deno bundle`, which minifies and drops everything unused.
// The script lands between the <!-- pixelfx --> markers in index.html; the game runs without it too.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PFX = resolve(process.argv[2] || join(ROOT, "..", "pixelfx"));
const WEATHER = ["god-rays", "cherry-blossoms", "rain", "fog", "fireflies", "clouds", "blizzard", "aurora", "snow", "falling-leaves", "shooting-stars", "storm"];
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const src = (p) => JSON.stringify(join(PFX, "src", p));

const entry = `
import { createFrame, clearFrame, composite, createFx, painterFor, Particles, Bits, P, PF, B, Rng, hex, sparkle } from ${src("core/index.js")};
${WEATHER.map((w) => `import * as ${camel(w)} from ${src(`fx/weather/${w}.js`)};`).join("\n")}
import * as iris from ${src("fx/transitions/iris.js")};
import * as starIris from ${src("fx/transitions/star-iris.js")};
window.PFX = { createFrame, clearFrame, composite, createFx, painterFor, Particles, Bits, P, PF, B, Rng, hex, sparkle,
  fx: { ${WEATHER.map(camel).join(", ")}, iris, starIris } };
`;
const dir = mkdtempSync(join(tmpdir(), "grudge-fx-"));
try {
  writeFileSync(join(dir, "entry.js"), entry);
  execFileSync("deno", ["bundle", "--no-config", "--quiet", "--format", "iife", "--platform", "browser", "--minify", join(dir, "entry.js"), "-o", join(dir, "out.js")], { stdio: "inherit" });
  const code = readFileSync(join(dir, "out.js"), "utf8").trim().replace(/<\/script/gi, "<\\/script");
  let version = "";
  try { version = execFileSync("git", ["-C", PFX, "log", "-1", "--format=%h %cs"], { encoding: "utf8" }).trim(); } catch {}
  const block = `<!-- pixelfx -->
<script>/* pixelfx ${version} (https://github.com/patch-gg/pixelfx): weather, transitions and particles.
   MIT License, Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez. See third_party/pixelfx. Built by tools/build-fx.mjs. */
${code}
</script>
<!-- /pixelfx -->`;
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const re = /<!-- pixelfx -->[\s\S]*?<!-- \/pixelfx -->/;
  const out = re.test(html) ? html.replace(re, () => block) : html.replace(/\n<script>\n'use strict';/, () => "\n" + block + "\n<script>\n'use strict';");
  if (out === html && !re.test(html)) throw new Error("could not find where to put the pixelfx script");
  writeFileSync(join(ROOT, "index.html"), out);
  console.log(`pixelfx ${version}: ${(code.length / 1024).toFixed(1)} KB packed into index.html`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
