#!/usr/bin/env node
// Proves levels can be beaten: a best-first search over button presses, played on the game's real code.
//
//   node tools/solve.mjs              every level
//   node tools/solve.mjs 51-100       a range (1-based, as shown in the menus: 51 is phase 11's first level)
//   node tools/solve.mjs 51 --show    print the winning inputs
//
// A level that needs you to die first (stones, a reveal after N deaths) can say so with `solve: { stones:
// [[tx, ty], ...], deaths: n }` and the solver starts from there, the way a player who knows would.
import { loadGame, frame } from "./harness.mjs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const show = args.includes("--show");
const budget = +(args.find((a) => a.startsWith("--nodes="))?.slice(8) ?? 250000);
let G = null;
/** Use another loaded game (tools/snap.mjs brings one that can draw). */
export function useGame(g) { G = g; }

const K = 4;                                         // frames per decision (1/15 s)
const ACTIONS = [];
for (const dir of [1, 0, -1]) for (const jump of [false, true]) ACTIONS.push({ dir, jump });

export const STEP = 4;
export function setup(i) {
  G.loadLevel(i);
  const pre = G.LEVELS[i].solve || {};
  if (pre.deaths) G.levelDeaths = pre.deaths;
  if (pre.stones) G.stones = pre.stones.map(([tx, ty]) => ({ tx, ty, born: -9 }));
  G.startAttempt();
  G.introT = 0;
}

// Levels whose hazards repeat on a clock (presses, blinking spikes, gusts) must tell one moment from another.
// Everywhere else, being somewhere earlier is never worse than being there later, so time can leave the key.
let cyclic = false;
function key(s, prevJump) {
  const p = s.player, d = s.door;
  let k = `${Math.round(p.x / 2)},${Math.round(p.y / 2)},${Math.round(p.vx / 15)},${Math.round(p.vy / 30)},${p.onGround ? 1 : 0},${prevJump ? 1 : 0}`;
  k += "|" + s.traps.map((t) => (t.done ? 1 : t.armed ? 2 : 0)).join("");
  for (const gr of s.groups) k += `|${gr.state[0]}${Math.round(gr.ox / 4)},${Math.round(gr.oy / 4)}${gr.gone ? "x" : ""}${gr.revealed ? "r" : ""}`;
  if (d) k += `|d${Math.round(d.x / 4)},${Math.round(d.y / 4)}`;
  if (cyclic) k += `|t${Math.floor(s.levelTime * 6)}`;
  if (s.reverseT > 0) k += "|R";
  if (s.mech) k += "|" + (s.mech.sig ?? "");
  return k;
}

export function solveLevel(i) {
  setup(i);
  const lv = G.LEVELS[i];
  cyclic = !!lv.wind || Object.values(lv.groups || {}).some((d) => d.patrol || d.blink || d.airMove);
  const start = G.snap();
  // The route: the designer's waypoints (if any), then the door. The search heads for the next one it hasn't reached.
  // waypoints are written in map rows; the map sits centered on screen, like the game places it
  const top = Math.max(0, Math.min(4 + Math.floor((G.ROWS - 4 - lv.map.length) / 2), Math.max(0, G.ROWS - lv.map.length)));
  const via = (lv.solve && lv.solve.via || []).map(([tx, my]) => [tx * 8 + 4, (my + top) * 8 + 4]);
  const goal = (k) => { if (k < via.length) return via[k]; const d = G.door; return d ? [d.x + 4, d.y + 12] : [0, 0]; };
  const leg = (k) => { let sum = 0; for (let j = k; j < via.length; j++) { const [ax, ay] = goal(j), [bx, by] = goal(j + 1); sum += Math.hypot(ax - bx, ay - by); } return sum; };
  // a binary heap on f
  const heap = [];
  const push = (n) => { heap.push(n); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p].f <= heap[c].f) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const seen = new Map();
  const wrap = !!G.LEVELS[i].wrap;
  const dist = (k) => {
    const [gx, gy] = goal(k), p = G.player;
    let dx = Math.abs(p.x + 3 - gx);
    if (wrap) dx = Math.min(dx, 320 - dx);                  // the world is round: the short way may be over the edge
    return Math.hypot(dx, (p.y + 4 - gy) * 1.6);
  };
  let k = 0;                                                 // waypoints reached by the node being expanded
  const h = () => dist(k) + leg(k);
  let best = null;
  push({ s: start, prev: null, act: null, steps: 0, f: h(), jump: false, k: 0 });
  let nodes = 0;
  const cap = Math.max(budget, (lv.solve && lv.solve.nodes) || 0);
  while (heap.length && nodes < cap) {
    const n = pop();
    nodes++;
    k = n.k;
    for (const a of ACTIONS) {
      G.restore(n.s);
      let st = "play";
      for (let k = 0; k < K && st === "play"; k++) st = frame(G, { left: a.dir < 0, right: a.dir > 0, jump: a.jump, press: k === 0 && a.jump && !n.jump });
      if (st === "dead") continue;
      const child = { s: null, prev: n, act: a, steps: n.steps + 1, jump: a.jump };
      if (st === "exit") return { ok: true, nodes, path: trace(child), time: (child.steps * K) / 60 };
      child.s = G.snap();
      child.k = n.k;
      if (child.k < via.length && dist(child.k) < 10) child.k++;   // close enough to this waypoint: on to the next
      k = child.k;
      // the door jumping somewhere else is the story moving on: prefer attempts that got that far
      const hh = h() - child.k * 400 - G.traps.reduce((n, t) => n + (t.done && t.do === "door" ? 250 : 0), 0);
      if (!best || hh < best.h) best = { h: hh, x: G.player.x / 8, y: G.player.y / 8, t: G.levelTime, node: child };
      const kk = key(child.s, a.jump) + "|w" + child.k;
      const was = seen.get(kk);
      if (was != null && was <= G.levelTime + 1e-9) continue;
      seen.set(kk, G.levelTime);
      child.f = hh + child.steps * 1.2;
      push(child);
    }
  }
  return { ok: false, nodes, best };
}
function trace(n) { const out = []; for (; n && n.act; n = n.prev) out.push(n.act); return out.reverse(); }
const fmt = (path) => {
  const out = [];
  for (const a of path) {
    const s = (a.dir < 0 ? "L" : a.dir > 0 ? "R" : "-") + (a.jump ? "J" : "");
    if (out.length && out[out.length - 1][0] === s) out[out.length - 1][1]++; else out.push([s, 1]);
  }
  return out.map(([s, n]) => s + "x" + n).join(" ");
};

function main() {
G = G || loadGame().g;
const N = G.LEVELS.length;
let range = [1, N];
const r = args.find((a) => /^\d+(-\d+)?$/.test(a));
if (r) { const [a, b] = r.split("-").map(Number); range = [a, b ?? a]; }
let bad = 0;
for (let n = range[0]; n <= range[1]; n++) {
  const i = n - 1, lv = G.LEVELS[i];
  if (!lv) continue;
  const t0 = Date.now(), res = solveLevel(i), label = `${String(n).padStart(3)}  ${(lv.phase + 1) + "-" + (lv.num + 1)}`.padEnd(10) + lv.name.padEnd(22);
  if (res.ok) console.log(`${label} ok    ${res.time.toFixed(1).padStart(5)}s of play   ${String(res.nodes).padStart(7)} nodes  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  else { bad++; const b = res.best; console.log(`${label} NOT SOLVED  (${res.nodes} nodes; closest at tile ${b ? b.x.toFixed(1) + ',' + b.y.toFixed(1) + ' after ' + b.t.toFixed(1) + 's' : '-'})`); }
  if (show && res.ok) console.log("      " + fmt(res.path));
  if (show && !res.ok && res.best) {
    console.log("      best try: " + fmt(trace(res.best.node)));
    // replay it and narrate where the hero went
    setup(i);
    let t = 0, prevJ = false;
    for (const a of trace(res.best.node)) {
      for (let k = 0; k < K; k++) frame(G, { left: a.dir < 0, right: a.dir > 0, jump: a.jump, press: k === 0 && a.jump && !prevJ });
      prevJ = a.jump; t++;
      if (t % 5 === 0) console.log(`        t=${(t * K / 60).toFixed(2)} at ${(G.player.x / 8).toFixed(1)},${(G.player.y / 8).toFixed(1)} ground=${G.player.onGround} traps=${G.traps.map((q) => (q.done ? 1 : 0)).join("")}`);
    }
  }
}
if (bad) { console.log(`\n${bad} level(s) not solved`); process.exitCode = 1; }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
