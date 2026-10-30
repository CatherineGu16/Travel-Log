<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Trips, pins, places and routes

- A **trip** is the main thing you log: "Utah Parks 2023". It has an ordered list of
  **destinations**, the places it went in visit order. Any number of them can be **main
  destinations**; the rest are stops along the way. Each destination can have its **own dates**
  ("3 days in Zion, then 3 in Las Vegas"), and a note.
- **Legs**: the stretch between two destinations is a **leg**, traveled by drive, flight, train,
  cruise, ferry, walk, or "not sure". It's guessed from the straight-line distance (over 250 mi is
  a flight, under is a drive) unless you pick one. There's no trip-level "how you traveled": a
  trip whose legs are **all drives is a road trip**, and a trip with **a cruise leg anywhere is a
  cruise**. Both are worked out from the legs, never stored, and only used to filter. See
  **Legs**.
- **Editing a trip** shows its own start, not the current Home: changing Home moves new trips only.
  To move an older trip (e.g. you lived elsewhere then), tap its start row in the Route step.
- **Who went**: the people who went. **Groups (Family, Friends, your own) only sort people**: they
  never add everyone in them. Filtering by a group finds trips with any of its members. (Trips
  tagged with a whole group by an earlier version keep the tag until you remove it.)
- A **place** is a location you've been to: "Zion National Park", "Las Vegas". Places are shared
  between trips, so going back to the same place reuses it instead of creating a duplicate.
- **One pin per major location**: a pin goes on each place that is a main destination of at least
  one trip. A trip with two main destinations has two pins. Stops don't get their own pins; they
  only appear as part of a route.
- **Pin colors**: **national park pins are green** (the place is linked to a park). All other
  pins use the standard accent color.
- **Dotted route**: selecting a pin shows the trip's route through all its destinations in the
  order you entered them: main destinations as pins, stops as numbered dots, joined by a dashed
  line. Other pins fade back while one is selected, and the map fits the route beside the Trips
  panel (or above the phone's Trips sheet).
- **Reusing the way you came**: a ground leg you haven't shaped uses roads already traveled on the
  trip where that's the better way: straight onto the nearest traveled stretch, along it in either
  direction, and straight off it to where it's going. An unmapped stretch counts as 3× its straight
  line, since stops on the way back are usually along the way you came, so the line keeps to the
  drawn way and only leaves it to reach a stop; it's only used when it saves at least 5%. So the drive down from Yosemite retraces the way up through
  Bakersfield and LA before turning off for Irvine, and a stop for food in Fresno on the way home
  doesn't stop the rest of the drive rejoining the way up and following it home. No button
  needed: just add the stops. Worked out when drawing, so reshaping the way up moves the way down.
- **Shaping a route**: the line between two destinations is straight unless you shape it. In Add
  / Edit trip, "Shape the route on the map" between two places opens the map with just that leg
  (A to B); each tap adds a bend where it fits along the leg, with Undo, Straighten, Cancel and
  Done. **Drag a dot** to move a bend (one Undo step per drag; tapping a dot doesn't add another).
  The rest of the trip shows faintly behind the leg, and the shaping card (A → B, a one-line hint,
  then Undo · Straighten · Cancel · Done) replaces the header while you shape.
  **Follow the way you came** (when the leg starts on the route drawn so far) sets the bends
  to run back along that route and leave it at the point closest to B, then straight there; taps
  after it add bends as usual, and Undo takes them back. Saved as the leg's bends, so it overrides
  the default for that leg. Bends aren't places: no pins, no search, no dates. Reordering or removing destinations
  drops the bends of any leg that changed.
- **Legs**: each leg is drawn by how you went: **flights** as a dashed great-circle arc in the
  accent color, **drives, trains, cruises, ferries and walks** as a solid line (straight unless
  shaped), and **not sure** as the thin dotted line. When a trip is selected the map fits its
  destinations, not its arcs, so a long flight can run off the edge while the places stay
  readable.
- **Stacked dates**: if you've been to a major location more than once (Chicago 2018, Chicago
  2022), it stays **one pin with a ×2 badge**. Its preview card stacks each visit's dates (that
  place's own dates when you gave them), newest first, with the newest selected: on a phone as
  **cards you swipe between** (with dots), on wider screens as **cards stacked in a column** that
  scrolls, the one on the map outlined ("On the map"); click a card to show its route. Each card
  lists the places in order (no travel modes, no home: those are on the map).
  **Picking a different trip redraws the route for that trip.** Any place, including a stop, shows every visit
  date stacked on its own detail view, and the parks checklist uses the dates you were at the park,
  not the whole trip's.
- **Older data**: trips saved before destinations (a main place plus stops) are converted when
  they're loaded or synced: the main place is slotted into the stops where it adds the least
  distance, which is how the map drew those routes.
