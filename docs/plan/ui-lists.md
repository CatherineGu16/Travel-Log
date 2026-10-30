<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# UI: trips, parks and trip details

## Trips list (non-map)
- Every trip in a plain, scrollable list: title, main destination, dates, stops count, and the
  faces of who went.
- **Group by**: Year (default, newest first) · State · Who went (Family, Friends, …, Other).
- **Sort**: Newest · Oldest · Title · Rating.
- **Who-went filter**: Family, Friends, other groups or people, same as the map. Filters are shared with the map
  and remembered per device, as in Watchlist.
- **Search** across title, places, description, people, groups and tags.
- **No travel-mode chip on rows** (here or on pin cards). Instead the Filter sheet has **Road
  trip** (every leg a drive), **Flight** (any leg a flight) and **Cruise** (any leg a cruise).
- Tapping a row opens the trip detail and highlights its route on the map.

## Places (dropped)
- There's no Places tab: map pins and the You page's **Most visited** cover it.

## National parks checklist (You › Parks)
- All 64 national parks as a checklist, A–Z or by state, with Visited / Not visited / All and a
  "14 / 64" progress bar.
- Visited parks show every visit date stacked (newest first) with links to the trips.
- **Hikes**: not a checklist. Each park row shows how many hikes you've done ("3 hikes").
  Opening a park shows **Hikes you've done**, each with its dates (stacked if done more than
  once), trip, NPS facts and link when it came from the NPS list, and Remove. **Add a hike** is a
  search box with suggestions: hikes you've done there before, then hikes added to the shared
  list, then the park's NPS day hikes with distance and time; or add exactly what you typed.
  Adding asks which trip it belongs to when you've been more than once.
- Unvisited parks have **"Log a visit"**, which opens Add trip with the park prefilled as the main
  destination.

## Trip detail
- **In the Trips panel or sheet over the map** (see navigation-and-layout.md), under the
  breadcrumb; the big map draws the route.
- Title, then dates, **how many days** and **roughly how far by each way of traveling** ("8 days ·
  ~194 mi driven · ~1,200 mi flown", from the drawn lines). Who went, then **the stops** in order (each with its **day of the trip**
  ("Days 2–3") and own dates, its note, and "Also
  here" chips for every other visit to that place, which open those trips). How you traveled
  between them isn't listed here (it's on the map and in Edit). Below the stops, the trip's
  **notes**: hikes (each park opens its page), description, highlights, rating and tags (each shows
  your trips with that tag). **Edit** next to each part opens the trip on that step (Who went →
  Details, Stops → Route, Notes → Notes); "Add notes, a rating or tags" when there are none.
  **Delete** with Undo, and Edit trip.
