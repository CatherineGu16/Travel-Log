<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# UI: header, navigation, settings, people, layout

## Header, navigation, settings
- **Navigation**: Map · **+** · **You** (trips are on the map, parks on You), kept in the URL hash
  so Back works; see navigation-and-layout.md for the addresses. On phones **Add trip** is a large
  colored circle raised between the bottom tabs.
- **Toolbar**: full width across the top: the title, a Map tab (wider screens), then **+ Add
  trip** (opens the form in the Trips panel), the sync chip (which opens Settings when there's a
  problem) and your photo (opens You). Phones add trips from the tab bar's +. All
  36 px tall. Anything you can press shows the hand cursor. People & groups, Parks and Settings
  are sections of the You page.
- **Settings** (You › Settings, or the sync chip): Sync across devices (same as Watchlist), **Map detail** (Outline · Detailed, with a
  note that Detailed contacts OpenFreeMap and Photon), People & groups (see below),
  Export/Import, theme. **Home** (pick your town from the bundled place search; synced in
  `travel.json`; new trips start from it; earlier trips keep the start they were made with) is in
  Settings too.

## People & groups
- **People**: a grid of avatar cards. Tap one to edit their name and avatar, see their groups, and
  see every trip they were on (with a count and their states/parks).
- **Avatar editor**: pick **initials** (auto from the name) or an **emoji**, choose a background
  color, or **add a photo** (camera roll / file picker, cropped to a circle in the app).
- **Groups**: create, rename and delete groups and add or remove members. **Family** and
  **Friends** exist from the start. A person can be in several groups. Groups only sort people:
  in a trip's Who went they're on/off shortcuts for their people, and a trip never records a group
  (see ui-trip-form.md).

## Responsive
- **Phone (≤640px)**: full-screen map with the Trips sheet over it, bottom tab bar, and bottom
  sheets for forms, filters and parks. Pinch to zoom, drag to pan, double-tap to zoom.
- **iPad / desktop**: the Trips panel on the left over the map; forms and other panels slide in
  from the right. Lists use a single
  centered column, as in Watchlist. Wheel to zoom, drag to pan, double-click to zoom.
- Tap targets ≥44px, no horizontal scroll at 360px, iOS safe areas respected.
- **Theme**: follows the system setting, with light and dark map styles to match (for both the
  outline and detailed maps).
