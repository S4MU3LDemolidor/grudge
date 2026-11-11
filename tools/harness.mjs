// Runs Grudge's own code headlessly in Node, so levels can be played by a program: no browser, no build.
// The game script is read from index.html and run in a sandbox with just enough of a fake page to load.
// It is the real physics and the real traps, so whatever the solver finds here works in the game.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SoftCanvas } from "./softcanvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Anything the page asks for that we don't model: a function that returns another one of itself.
function stub(base = {}) {
  const f = function () { return stub(); };
  return new Proxy(Object.assign(f, base), {
    get(t, k) { if (k in t) return t[k]; if (k === Symbol.iterator) return undefined; if (k === Symbol.toPrimitive) return () => 0; return stub(); },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function element(extra = {}) {
  return stub({ hidden: false, style: stub(), classList: stub(), children: [stub(), stub()], width: 320, height: 180,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }), getContext: () => context(), ...extra });
}
function context() {
  return stub({ fillStyle: "#000", globalAlpha: 1, imageSmoothingEnabled: false,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) });
}

/** Load the game. opts.fx: also run the pixelfx bundle. opts.canvas: draw for real, into a SoftCanvas (G.canvas). */
export function loadGame({ fx = false, canvas = false } = {}) {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const game = scripts[scripts.length - 1], bundles = scripts.slice(0, -1);
  const store = {};
  const sandbox = {
    console, Math, JSON, Date, Set, Map, Array, Object, Number, String, Uint8Array, Uint32Array, Float32Array, Uint8ClampedArray, Promise, Proxy, Symbol, Error,
    matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720,
    getComputedStyle: () => ({}),
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: {}, performance: { now: () => 0 }, requestAnimationFrame() {},
    location: { hash: "", href: "http://localhost/" }, history: { replaceState() {} },
    prompt: () => null, confirm: () => false, btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    ImageData: class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } },
  };
  const elements = {};
  if (canvas) elements.game = new SoftCanvas(320, 180);
  sandbox.document = stub({
    getElementById: (id) => (elements[id] ??= element()), querySelector: () => element(), createElement: (tag) => (canvas && tag === "canvas" ? new SoftCanvas() : element()),
    documentElement: element(), body: element(), fullscreenEnabled: false, hidden: false,
  });
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  if (fx) for (const b of bundles) vm.runInContext(b, ctx, { filename: "pixelfx-bundle.js" });
  // Expose the game's own top-level bindings, and a way to save and restore a whole attempt
  const expose = `
;globalThis.__g = {
  get state() { return state; }, set state(v) { state = v; },
  get L() { return L; }, get li() { return li; }, get player() { return player; }, get door() { return door; },
  get groups() { return groups; }, get traps() { return traps; }, get stones() { return stones; }, set stones(v) { stones = v; },
  get levelTime() { return levelTime; }, get levelDeaths() { return levelDeaths; }, set levelDeaths(v) { levelDeaths = v; },
  get introT() { return introT; }, set introT(v) { introT = v; }, get reverseT() { return reverseT; },
  get spawn() { return spawn; }, get grid() { return grid; }, get save() { return save; },
  input, LEVELS, PHASES, TS, COLS, ROWS, DT, MAIN_LEVELS,
  loadLevel, startLevel, startAttempt, updatePlay, update, render, kill, tileAt,
  calm() { fade.a = 0; fade.dir = 0; fade.cb = null; if (typeof fx !== 'undefined') fx.trans = null; hitStop = 0; toastT = 0; flashT = 0; },
  snap() {
    return {
      player: { ...player }, door: door && { ...door, flee: door.flee && { ...door.flee } },
      groups: groups.map(g => ({ ...g })), traps: traps.map(t => ({ ...t })), stones: stones.map(s => ({ ...s })),
      levelTime, reverseT, state, introT, deaths, levelDeaths, jumpsThisTry: jumpsThisTry.slice(), grudgeAt,
      mech: typeof mech === 'undefined' ? null : mechSnap(),
    };
  },
  restore(s) {
    player = { ...s.player }; door = s.door && { ...s.door, flee: s.door.flee && { ...s.door.flee } };
    groups = s.groups.map(g => ({ ...g })); gmap = {}; for (const g of groups) gmap[g.id] = g;
    traps = s.traps.map(t => ({ ...t })); stones = s.stones.map(x => ({ ...x }));
    levelTime = s.levelTime; reverseT = s.reverseT; state = s.state; introT = s.introT; deaths = s.deaths; levelDeaths = s.levelDeaths;
    jumpsThisTry = s.jumpsThisTry.slice(); grudgeAt = s.grudgeAt; particles = [];
    if (s.mech) mechRestore(s.mech);
  },
};`;
  vm.runInContext(game + expose, ctx, { filename: "index.html" });
  return { g: ctx.__g, ctx, canvas: elements.game };
}

/**
 * One frame of play with the given buttons held. Mirrors the browser loop: a jump press is an edge.
 * Returns the game's state afterwards ('play' | 'dead' | 'exit').
 */
/** The same, but through the whole game loop (fades, the iris, weather): for pictures, not for searching. */
export function tick(G, { left = false, right = false, jump = false, press = false } = {}) {
  const inp = G.input;
  inp.left = left; inp.right = right;
  if (press && !inp.jump) inp.jumpPressed = true;
  inp.jump = jump;
  G.update(G.DT);
  return G.state;
}
export function frame(G, { left = false, right = false, jump = false, press = false }) {
  const inp = G.input;
  inp.left = left; inp.right = right;
  if (press && !inp.jump) inp.jumpPressed = true;
  inp.jump = jump;
  G.updatePlay(G.DT);
  inp.jumpPressed = false; inp.restartPressed = false;
  return G.state;
}
