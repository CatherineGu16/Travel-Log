<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# UI: header, navigation, settings, people, layout

## Header, navigation, settings
- **Header**: states n/50 and parks n/64 progress, trips this year (on wide screens), and the sync
  status chip (a colored dot on phones).
- **Navigation**: Map · Trips · **+** · Places · Parks, kept in the URL hash so Back works. **Add
  trip** is a large colored circle in the center: raised above the bottom tab bar on phones, in the
  middle of the header's page links on wider screens. **Planned**: Map · Trips · **+** · Parks ·
  **You**, with People & groups, Settings and Home moving into the profile (see
  profile-and-achievements.md).
- **Settings**: Sync across devices (same as Watchlist), **Home** (pick your town from the bundled
  place search; synced in `travel.json`; new trips start from it; earlier trips keep the start they were made with), **Map detail** (Outline · Detailed, with a
  note that Detailed contacts OpenFreeMap and Photon), People & groups (see below),
  Export/Import, theme.

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
- **Phone (≤640px)**: full-screen map, bottom tab bar, and bottom sheets for previews, details and
  forms. Pinch to zoom, drag to pan, double-tap to zoom.
- **iPad / desktop**: the detail panel slides in from the right over the map. Lists use a single
  centered column, as in Watchlist. Wheel to zoom, drag to pan, double-click to zoom.
- Tap targets ≥44px, no horizontal scroll at 360px, iOS safe areas respected.
- **Theme**: follows the system setting, with light and dark map styles to match (for both the
  outline and detailed maps).
