# Grudge

*The level never forgets. Neither do you.*

A tiny troll platformer in a single HTML file. 20 phases of 5 levels, plus a bonus phase that remembers where you jumped. When you die on spikes you leave a solid grave stone behind, and you can stand on it next time.

The first ten phases end at THE LAST DOOR, which promises it is the last door. It lies. Ten more phases follow, each with a new trick:

| Phase | Trick |
|---|---|
| 11 THE LOOP | No side walls: walk off one edge, come in at the other. |
| 12 FROSTBITE | Ice. You can't stop. |
| 13 THE GALE | Gusts that push you around, announced a moment before they hit. Push against one with your feet on the ground and you stand firm. |
| 14 THE FLOOD | The water rises. Climb. |
| 15 LIGHTS OUT | You only see a circle around you, and the odd flash of lightning. |
| 16 THE ECHO | Your own shadow walks your path a second or so behind you. Don't be where you were. |
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

## Languages

English, Português, Español, Français and Deutsch. The game starts in your browser's language (English if it isn't one of these); change it under **OPTIONS > LANGUAGE**, and it remembers your choice.

The level editor is taking a break and will come back in a later version. Until then, level links made with it open the home screen with a note saying so.

## On phones

On-screen controls appear automatically. Hold the phone sideways for the biggest view. The arrows are one strip, so you can slide your thumb between them without lifting it. Back and restart are in the top corners, away from JUMP.

For a full-screen, app-like version, use **Add to Home Screen** from the browser's share or menu button.

## Run it locally

Open `index.html` in a browser. There's nothing to install or build.

## For level makers and tinkerers

The `tools` folder runs the game's own code in Node, with no browser:

- `node tools/solve.mjs` searches for a way through every level and says which ones it beat (`node tools/solve.mjs 51-100` for a range, `--show` for the winning inputs). A level that needs the solver to take a particular route can list waypoints in `solve: { via: [[x, row], ...] }`; one that needs you to die first can start with `solve: { stones, deaths }`.
- `node tools/snap.mjs 11-20 --out snaps` takes pictures of each phase's levels being beaten, one sheet per phase.
- `node tools/i18n.mjs check` says which lines each language is missing, and which ones don't fit on screen in the pixel font. After changing any text in the game: `node tools/i18n.mjs extract` lists every English line in `tools/i18n/en.txt`, add the new lines to `tools/i18n/<lang>.json` (English on the left, translation on the right), then `node tools/i18n.mjs build` packs them into `index.html`. A line nobody has translated yet shows in English.
- `node tools/build-fx.mjs path/to/pixelfx` repacks the pixelfx effects into `index.html` (needs [Deno](https://deno.com)). Only needed if you change which effects the game uses.

Saves from before phases 11-20 carry over: anything you won in the bonus phase moves with it, and if you had already seen the ending, the bonus phase stays open.

## Credits

Effects by [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, Patch and Hugo Duprez); see `third_party/pixelfx`.
