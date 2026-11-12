#!/usr/bin/env node
// Grudge's translations. Every word on screen is English in the code and goes through tr(); this finds them all,
// checks the other languages have each one (and that each fits on screen in the pixel font), and packs them in.
//
//   node tools/i18n.mjs extract           list every English string in tools/i18n/en.txt, one per line
//   node tools/i18n.mjs adopt pt          turn tools/i18n/pt.txt (same lines, translated) into tools/i18n/pt.json
//   node tools/i18n.mjs check             what's missing or too long in each language
//   node tools/i18n.mjs build             check, then pack every language into index.html
//
// tools/i18n/<lang>.json maps English to the translation, so editing a level later only needs its new lines.
// Write translations in capitals; accents are fine (Á À Â Ã Ä Ç É È Ê Ë Í Ì Î Ï Ñ Ó Ò Ô Õ Ö Ú Ù Û Ü Ÿ ¡ ¿), ß is not (use SS).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadGame } from "./harness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "tools", "i18n");
const LANGS = ["pt", "es", "fr", "de"];
const [cmd = "check", arg] = process.argv.slice(2);

// Every English string, in the order a player meets them, and what kind it is (that decides how much room it has)
function collect() {
  const { g: G, ctx } = loadGame();
  const run = (code) => vm.runInContext(code, ctx);
  const out = new Map();
  const add = (s, kind) => { if (s && !out.has(s)) out.set(s, kind); };
  for (const ph of G.PHASES) {
    add(ph.name, "title"); add(ph.tag, "line");
    for (const lv of ph.levels) {
      add(lv.name, "title"); add(lv.hint, "narrator"); add(lv.pity, "narrator");
      for (const q of lv.quips || []) add(q, "death");
      for (const t of lv.traps || []) add(t.say, "narrator");
    }
  }
  for (const list of Object.values(run("QUIPS"))) for (const q of list) add(q, q.length > 24 ? "narrator" : "death");
  for (const gr of run("GREETINGS")) add(gr, "narrator");
  for (const sk of run("SKINS")) { add(sk.name, "line"); if (sk.need) add(sk.need.text, "line"); }
  // ...and every tr('...') written in the code
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const game = html.slice(html.lastIndexOf("<script>"));
  for (const m of game.matchAll(/(?<![\w.])tr\(\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), "line");
  for (const m of game.matchAll(/(?:showToast|setNarr)\(\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), "line");
  for (const k of ["TURN YOUR PHONE SIDEWAYS", "FOR A BIGGER SCREEN", "JUMP"]) add(k, "line");
  add("DEATH #{n}. DELIGHTFUL.", "death");
  // the ranks at the end
  for (const m of game.matchAll(/'(THE LEVEL IS AFRAID OF YOU\.|A RESPECTABLE AMOUNT OF SPITE\.|THE LEVEL HAD A WONDERFUL TIME\.|THE LEVEL WOULD LIKE TO KEEP YOU\.)'/g)) add(m[1], "line");
  return out;
}

// How wide a string is in the game's 3x5 font (4 px per letter), and which letters it can draw
const FONT_OK = /^[A-Z0-9 .,!?'"\-:\/()<>+#=_¡¿ÁÀÂÃÄÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜŸ{}]*$/;
const width = (s) => [...s.replace(/\{\w+\}/g, "00")].length * 4 - 1;
function wrapCount(s, maxW = 312) {
  let lines = 1, cur = "";
  for (const w of s.split(" ")) { const t = cur ? cur + " " + w : w; if (cur && width(t) > maxW) { lines++; cur = w; } else cur = t; }
  return lines;
}
// Lines with less room than the usual 300px: the ending screens start at x=20, and two lines there sit beside the pile of stones
const ROOM = {
  "PHASE {n} IS OPEN. IT REMEMBERS YOU.": 176, "PRESS JUMP FOR THE MENU": 184,
  "{n} LEVELS CLEARED. TOTAL DEATHS": 292, "THE LEVEL IS AFRAID OF YOU.": 292, "A RESPECTABLE AMOUNT OF SPITE.": 292,
  "THE LEVEL HAD A WONDERFUL TIME.": 292, "THE LEVEL WOULD LIKE TO KEEP YOU.": 292, "IT WILL REMEMBER YOU.": 292,
  "TIME {t}    DEATHLESS {n}": 260, "THE LAST DOOR LIED. IT DOES THAT.": 292, "TEN MORE PHASES. THE LEVEL IS JUST GETTING STARTED.": 292,
};
function problems(en, t, kind) {
  const out = [];
  if (ROOM[en] && width(t) > ROOM[en]) out.push(`too wide for its spot on the ending screen: ${width(t)} px (${ROOM[en]} max)`);
  const bare = t.replace(/\{\w+\}/g, "");                 // placeholders are filled in with numbers and names
  if (!FONT_OK.test(bare)) out.push(`letters the font can't draw: ${[...bare].filter((c) => !FONT_OK.test(c)).join("")}`);
  const vars = (s) => [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort().join();
  if (vars(en) !== vars(t)) out.push(`placeholders differ (${vars(en)} vs ${vars(t)})`);
  if (kind === "narrator" && wrapCount('"' + t + '"') > 2) out.push(`too long: ${wrapCount('"' + t + '"')} lines on screen (2 max)`);
  if (kind !== "narrator" && width(t) > 300) out.push(`too wide: ${width(t)} px (300 max)`);
  if (kind === "title" && [...t].length > 38) out.push(`title too long: ${[...t].length} letters (38 max)`);
  return out;
}
const load = (l) => (existsSync(join(DIR, l + ".json")) ? JSON.parse(readFileSync(join(DIR, l + ".json"), "utf8")) : {});

if (cmd === "extract") {
  const all = collect();
  writeFileSync(join(DIR, "en.txt"), [...all.keys()].join("\n") + "\n");
  console.log(`${all.size} strings -> tools/i18n/en.txt`);
} else if (cmd === "adopt") {
  const en = readFileSync(join(DIR, "en.txt"), "utf8").replace(/\n$/, "").split("\n");
  const tx = readFileSync(join(DIR, arg + ".txt"), "utf8").replace(/\n$/, "").split("\n");
  if (en.length !== tx.length) { console.error(`${arg}.txt has ${tx.length} lines, en.txt has ${en.length}`); process.exit(1); }
  const map = { ...load(arg) };
  // capitals, except the {placeholders}, which must match the English ones exactly
  en.forEach((e, i) => { map[e] = tx[i].trim().split(/(\{\w+\})/).map((p, k) => (k % 2 ? p.toLowerCase() : p.toUpperCase())).join("").normalize("NFC"); });
  writeFileSync(join(DIR, arg + ".json"), JSON.stringify(map, null, 1) + "\n");
  console.log(`tools/i18n/${arg}.json: ${Object.keys(map).length} strings`);
} else {
  const all = collect();
  let bad = 0;
  for (const l of LANGS) {
    const map = load(l);
    const missing = [...all.keys()].filter((e) => !map[e]);
    if (missing.length) { bad += missing.length; console.log(`${l}: ${missing.length} missing, e.g. ${missing.slice(0, 3).map((m) => JSON.stringify(m)).join(", ")}`); }
    for (const [e, kind] of all) if (map[e]) for (const p of problems(e, map[e], kind)) { bad++; console.log(`${l}: ${JSON.stringify(map[e])}: ${p}`); }
  }
  for (const [e, kind] of all) for (const p of problems(e, e, kind)) console.log(`en: ${JSON.stringify(e)}: ${p}`);
  if (cmd === "build") {
    const en = [...all.keys()], I18N = { en };
    for (const l of LANGS) { const map = load(l); I18N[l] = en.map((e) => map[e] || ""); }
    const p = join(ROOT, "index.html"), html = readFileSync(p, "utf8");
    const re = /\/\* i18n:begin \*\/[\s\S]*?\/\* i18n:end \*\//;
    if (!re.test(html)) throw new Error("no i18n markers in index.html");
    writeFileSync(p, html.replace(re, () => `/* i18n:begin */\nconst I18N = ${JSON.stringify(I18N)};\n/* i18n:end */`));
    console.log(`packed ${en.length} strings x ${LANGS.length + 1} languages into index.html${bad ? ` (${bad} problems above)` : ""}`);
  } else console.log(bad ? `${bad} problems` : "all languages complete and fitting");
}
