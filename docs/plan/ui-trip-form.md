<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# UI: add / edit trip

**Where it opens**: on wider screens, in the **Trips panel** beside the map (Trips › Add trip, or
Trips › Utah 2023 › Edit trip, with the steps under the heading), from the toolbar's **+ Add
trip** or a trip's Edit; from You (Log a visit, or Add trip) it goes to the map first. It stays in the panel (hidden, keeping what you
typed) if you go to another page, and the panel can't be hidden while it's open; Escape or Cancel
closes it. The breadcrumb's links (Trips, or the trip you're editing) leave it too: straight away
if nothing changed, otherwise after "Discard this trip?" (Keep editing / Discard). Phones: a full-screen sheet, as before. On the **Route step** the trip so far is drawn
on the big map as you add places (places not saved yet get a ★) and the map fits it beside the
panel. **Shaping a leg** keeps the form in the panel while the map shows that leg with the shaping
bar (Undo, Straighten, Cancel, Done); you can also **tap a leg's line on the map** to shape it. On
phones the sheet steps aside while you shape.

**Route step layout**: one vertical **timeline**. A line runs down a narrow left column, styled like
each leg on the map (solid for ground, dashed for a flight, dotted when not sure), with each stop's
marker on it: home, a pin for a main place, a number for a stop, and a dashed "+" node for adding a
place (after the last place, before the way back). Beside each place: its full name (wrapping, not
cut off), then a small **Main / Stop** chip and its dates; **⋯** holds Move up, Move down, Change
place, name or note, and Remove. Beside each leg: "🚗 Drive · 143 mi · guess" (tap to change) and
Shape on map. A one-line hint replaces the old paragraph.

A **three-step stepper**, so trip details and mapping out the route are on separate pages: **1.
Details** (title, dates, who went), **2. Route** (where it started and ended, destinations in order, the leg between
each pair, coming back the same way), **3. Notes** (hikes, description, highlights, rating, tags). Back and
Next keep everything; Save works from the Route step on, since Notes is optional. Editing a trip
opens the same steps with tabs to jump straight to one.

- **Where you went**: add destinations in order: search a place (your places and parks first, then
  cities and towns in the US and abroad, **biggest first**: size on a log scale, with towns near
  the trip's main destination counted as 20× bigger, so a nearby town beats a bigger one far away
  but not a city many times its size ("Lisbon" is Portugal's); plus
  landmarks and addresses when the detailed map is on). Long-press (or right-click) the map to
  start a trip at that spot. Picking a place you've been to before reuses it, so the new dates
  stack onto it. A dropped pin gets its state from the bundled outlines and its nearest town from
  the bundled places list, and can be renamed. (There's no "Pick on map" in the form: a tap can't
  place a spot exactly, so tapping the map is used to shape routes instead.)
  - Each place has a **Main / Stop** pill: Main places get a pin on the map, stops get a number
    on the route. Tap it to switch. The first place starts as Main, and a trip keeps at least one.
  - Each destination can have **its own dates**: its row's **📅 Add dates** opens a **strip of the
    trip's days** ("Day 1 · Wed · May 1" …) right under it: tap the day you got there, then the day
    you left (or the same day again), and it closes, showing "Days 2–3 · May 2 – 3". The next
    stop's strip opens on the day the one before ended. "Other dates…" (days outside the trip),
    trips without whole-day dates, trips over 60 days, and new trips whose dates you haven't set
    (they follow the stops) use the calendar instead. Tap a place's name for the rest: change
    place, rename, note. On a new trip, stop dates fill in the trip's start and end until you set
    those yourself.
  - A place inside a national park offers to be linked to the park ("This is inside Zion National
    Park. Count it as a visit?").
  - Move up / down, remove.
  - Between two destinations, a **leg row**: a small rail (solid for ground, dashed for flights),
    the mode with its icon, the straight-line distance, "guessed" until you pick one, and a tap
    target of at least 44 px that opens a one-step mode picker. Ground legs also have **"Shape the
    route on the map"** (see **Shaping a route** in trips-and-routes.md); this is how a drive follows the real road, since
    the app uses no routing service.
  - The Route step starts and ends with where the trip started (Home by default), with the way
    there and back as leg rows: **a flight unless you change it** (tap the leg; the same mode picker
    as other legs, never guessed). Unless they're flights, they can be shaped on the map like any
    leg ("Shape on map", Straighten; the way back offers "Follow the way you came"); their bends
    reset when the first or last place or the start changes. Tap the start or end row to pick
    another place for this trip, or "Use home" for the current Home.
  - Tap a place's dates line to open it: **Change to another place** (the same place search)
    swaps the place, keeping its dates, note and pin, and resets the legs to and from it; then its
    own dates and note.
  - **Add another destination** sits right after the last place, above the way back.
  - (A "Came back the same way" switch was removed: the drive back follows the way there on its
    own, with any stops on the way back, and "Follow the way you came" covers the rest.)
- **Trip dates**: a **date range picker**: tap the first day, then the last, on a calendar (Date),
  a month grid (Month) or a year grid (Year). The month and year menus above the calendar jump to
  any date. Folded to one row showing the dates until you tap it, and folded again once you tap
  the last day. ("Dates are approximate" is no longer asked; trips that have it keep it.)
- **Title** (suggested from the main destinations and year, e.g. "Zion & Las Vegas 2024").
- **Hikes**: for every national park on the trip, the hikes you did there, added with the same
  **Add a hike** search box and suggestions as the park page (no checklist).
- **Who went**: your **groups as chips that are on or off** (Family, Friends, your own): on brings
  everyone in the group, off takes them all off; a group that's on stands for its people, so they
  aren't listed one by one. **Anyone else going** shows as a chip with ×. People not in a group
  aren't listed until you **search** for them. Typing a name that isn't anyone offers people with
  a similar name first ("Did you mean Alexa?"), then **Add “…” as someone new**, in whichever
  groups you tick. The trip only records the people, never the groups (so a group is "on" when
  everyone in it went).
- Optional (Notes step): hikes, description and highlights (the boxes grow as you type), rating,
  **tags as chips**: tags on your other trips (most used first) and your group names are offered
  as chips to tap; type a new one and press Enter or a comma; × removes one. "Family" is a tag
  like any other, not part of who went.
- Save, then the map flies to the new pin and shows its route.
- **On phones**, while the on-screen keyboard is open the form fills exactly the visible part of the
  screen (iPhone Safari pans the page when you tap a field) and scrolls on its own, so the title
  and first field stay in view. The Add trip / Cancel buttons hide until the keyboard closes.
