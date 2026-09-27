---
version: 1
slug: "apps-desktop-src-renderer-app-tsx"
primary_target: "apps/desktop/src/renderer/App.tsx"
related_targets: ["apps/web/src/App.tsx","packages/ui/src/GameApp.tsx"]
---

# Desktop and web game

Mode: Operate. Replace setup, playing, and results in the Electron renderer and web app. Native mobile and shared engine/backend behavior are out of scope. The owner approved separate platform interfaces and delegated this visual choice.

## Direction contract

THESIS: A tactile modern game console, adapted from a music sampler's input pads and persistent transport. Refuse the full-width spreadsheet beneath a tiny dice strip.

OWN-WORLD: Mineral-white shell, evergreen play deck, porcelain pip dice, clay-orange primary action, Manrope lettering, aligned tabular scores. Dark mode uses graphite-green surfaces without neon. Controls have explicit focus, pressed, disabled, and pending states.

STORY: Enter a name and choose the game. Roll, hold dice, then commit one legal category. See totals, bonus progress, and final results without hunting through decoration.

FIRST VIEWPORT: A compact brand bar above a left-hand dice deck and right-hand split scorecard. The large roll action stays under the dice. At narrow widths, play precedes scoring. Holding lifts and marks a die; rerolling animates only unheld dice and respects reduced motion.

FORM: Candidate 5 of seven, modern music sampler; seed c28b6587. The owner delegated the choice. Code-led implementation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
