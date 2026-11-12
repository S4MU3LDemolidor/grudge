# Grudge

*The level never forgets. Neither do you.*

A tiny troll platformer in a single HTML file. 20 phases of 5 levels, plus a bonus phase that remembers where you jumped. When you die on spikes you leave a solid grave stone behind, and you can stand on it next time.

The first ten phases end at THE LAST DOOR, which promises it is the last door. It lies. Ten more phases follow, each with a new trick:

| Phase | Trick |
|---|---|
| 11 THE LOOP | No side walls: walk off one edge, come in at the other. |
| 12 FROSTBITE | Ice. You can't stop. |
| 13 THE GALE | Gusts that push you around, announced a moment before they hit. |
| 14 THE FLOOD | The water rises. Climb. |
| 15 LIGHTS OUT | You only see a circle around you, and the odd flash of lightning. |
| 16 THE ECHO | Your own shadow walks your path a few seconds behind you. Don't be where you were. |
| 17 BOUNCE HOUSE | Springs that launch you whether you like it or not. |
| 18 THE FACTORY | Conveyor belts, which sometimes change their minds. |
| 19 THE MOON | Low gravity, low ceilings. |
| 20 THE END | All of it at once. |

Every phase also has its own weather, drawn with [pixelfx](https://github.com/patch-gg/pixelfx) in the phase's own colors: light through the windows, petals, rain, fog, fireflies, snow, leaves, shooting stars, storms. Deaths throw debris that lands on the platforms, grave stones land with a puff of dust, and an iris closes on the door when you get out. With reduced motion turned on in your system, the game plays without them.

**Play:** https://s4mu3ldemolidor.github.io/grudge/

## Controls

| Action  | Keyboard            | Gamepad      |
|---------|---------------------|--------------|
| Move    | Arrows / WASD       | D-pad, stick |
| Jump    | Space / Up / W / Z  | A            |
| Restart | R                   | X / Y        |
| Menu    | Esc                 | B / Select   |
| Sound   | M                   |              |
| Full screen | F (or OPTIONS)  |              |

The game scales up to fill the whole window. Press F for full screen, where your browser allows it.

## Make your own levels

Pick **MAKE A LEVEL** on the home screen. Paint ground, spikes, the start and the door, then add traps: crumbling floors, drop blocks, shy spikes, ghost blocks, fake blocks, lifts and chasers. Give it a name and a narrator line (a good lie works best), pick a theme, and press **TEST**.

Once you've beaten your own level, **SHARE** makes a link. Anyone who opens it plays your level straight away, with no account and no server: the whole level lives inside the link. Links made before phases 11-20 still open with the theme they were made with.

## On phones

On-screen controls appear automatically. Hold the phone sideways for the biggest view. The arrows are one strip, so you can slide your thumb between them without lifting it. Back and restart are in the top corners, away from JUMP.

For a full-screen, app-like version, use **Add to Home Screen** from the browser's share or menu button.

## Run it locally

Open `index.html` in a browser. There's nothing to install or build.

## For level makers and tinkerers

The `tools` folder runs the game's own code in Node, with no browser:

- `node tools/solve.mjs` searches for a way through every level and says which ones it beat (`node tools/solve.mjs 51-100` for a range, `--show` for the winning inputs). A level that needs the solver to take a particular route can list waypoints in `solve: { via: [[x, row], ...] }`; one that needs you to die first can start with `solve: { stones, deaths }`.
- `node tools/snap.mjs 11-20 --out snaps` takes pictures of each phase's levels being beaten, one sheet per phase.
- `node tools/build-fx.mjs path/to/pixelfx` repacks the pixelfx effects into `index.html` (needs [Deno](https://deno.com)). Only needed if you change which effects the game uses.

Saves from before phases 11-20 carry over: anything you won in the bonus phase moves with it, and if you had already seen the ending, the bonus phase stays open.

## Credits

Effects by [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, Patch and Hugo Duprez); see `third_party/pixelfx`.
