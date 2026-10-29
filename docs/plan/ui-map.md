<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# UI: the map

## Map view (home)
- Full-screen **outline map** (states, park boundaries, lakes, major-city labels) that opens fitted
  to the continental US, with zoom +/-, "Reset to US", and a 🌐 toggle between the flat map and a
  globe (see roadmap.md).
- **Visited states shaded darker by number of trips** (1 · 2–3 · 4–6 · 7+), with a small legend.
  Hover (desktop) or tap (mobile) shows the state name and trip count.
- **Location pins**, one per major location (×N badge when visited more than once), clustered
  when zoomed out. **Green pins are national parks**; all others use the accent color. A small
  legend explains the colors.
- Tapping a pin opens a **preview card** with the place name and its **stacked visit dates**. The
  newest visit is selected and its **dotted route** is drawn. Tapping another date switches the
  card (title, who went, stops, hikes) and redraws the route for that trip.
- **Filter button**:
  - **With**: groups (trips with any of their people) and people, plus year, tag and how you
    traveled (Road trip / Flight / Cruise, from the legs).
  - **National parks layer** (the Parks button on the map, remembered per device): Off · All ·
    Visited · Not visited. All 64 parks show as small tree badges (so they don't look like trip
    pins). Visited parks are filled green (with a shaded boundary when zoomed in); not-yet-visited
    parks are gray, with a dashed outline when zoomed in. Tapping a badge opens that park. A segmented
    control switches between **All · Visited · Not visited**, with a **"14 / 64 parks"** progress
    line.
  - Year and tag.
- **Add trip**: the colored **+** circle in the center of the navigation, always visible.
