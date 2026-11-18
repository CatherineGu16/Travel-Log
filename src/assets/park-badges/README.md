# Park badge art

One file per national park, named by its id (`zion.svg`, `wrangell-st-elias.png`, …). The full
list of ids and the spec are in `docs/plan/park-badges.md` §1.

- SVG preferred; PNG or WebP at 512 × 512 px with a transparent background also work.
- The file is the **colored, earned** badge. Optionally add `<id>-outline.svg` (or `.png`) for how
  it looks **not visited**; without one the app shows the colored art grayed and faded, in a ring.
- Any file here is picked up by the next build; a park without one shows a placeholder badge.
