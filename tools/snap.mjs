#!/usr/bin/env node
// Pictures of levels being beaten: solves each level, plays the winning run through the real game loop (weather,
// debris, the iris and all) and saves frames along the way. One sheet per phase: a row per level, left to right
// through the run.
//
//   node tools/snap.mjs 11 --out /tmp/grudge-snaps     phase 11 (rows: 11-1 .. 11-5)
//   node tools/snap.mjs 11-20 --out /tmp/grudge-snaps  phases 11 to 20
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGame, tick } from "./harness.mjs";
import { useGame, setup, solveLevel, STEP } from "./solve.mjs";
import { encodePNG } from "./softcanvas.mjs";

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "snaps";
const cols = +(args.includes("--cols") ? args[args.indexOf("--cols") + 1] : 4);
const [p0, p1 = p0] = (args.find((a) => /^\d+(-\d+)?$/.test(a)) || "1").split("-").map(Number);
mkdirSync(out, { recursive: true });

const { g: G, canvas } = loadGame({ fx: true, canvas: true });
useGame(G);
const W = 320, H = 180, GAP = 2;

for (let ph = p0; ph <= p1; ph++) {
  const rows = [];
  for (let k = 0; k < 5; k++) {
    const i = (ph - 1) * 5 + k;
    if (!G.LEVELS[i]) continue;
    const res = solveLevel(i), frames = [];
    // replay the winning run (or just stand there, if none) and keep `cols` evenly spaced moments
    G.calm();
    setup(i);
    const steps = res.ok ? res.path : Array.from({ length: 30 }, () => ({ dir: 0, jump: false }));
    const total = steps.length * STEP + 30, want = new Set(Array.from({ length: cols }, (_, c) => Math.round((c * (total - 1)) / (cols - 1))));
    let f = 0, prevJ = false;
    const grab = () => { if (want.has(f)) { G.render(); frames.push(canvas.data.slice()); } f++; };
    for (const a of steps) for (let s = 0; s < STEP; s++) { tick(G, { left: a.dir < 0, right: a.dir > 0, jump: a.jump, press: s === 0 && a.jump && !prevJ }); if (s === STEP - 1) prevJ = a.jump; grab(); }
    while (f < total) { tick(G, {}); grab(); }
    rows.push(frames);
    console.log(`${ph}-${k + 1} ${G.LEVELS[i].name}: ${res.ok ? "beaten in " + ((res.path.length * STEP) / 60).toFixed(1) + "s" : "NOT SOLVED"}`);
  }
  const SW = cols * W + (cols - 1) * GAP, SH = rows.length * H + (rows.length - 1) * GAP, sheet = new Uint8ClampedArray(SW * SH * 4);
  rows.forEach((frames, r) => frames.forEach((fr, c) => {
    for (let y = 0; y < H; y++) sheet.set(fr.subarray(y * W * 4, (y + 1) * W * 4), (((r * (H + GAP) + y) * SW) + c * (W + GAP)) * 4);
  }));
  const file = join(out, `phase-${String(ph).padStart(2, "0")}.png`);
  writeFileSync(file, encodePNG(SW, SH, sheet));
  console.log("  -> " + file);
}
