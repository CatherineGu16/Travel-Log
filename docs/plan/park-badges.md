<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Park badges (M12, planned)

You › Parks becomes a **grid of badges**, one per national park (64), instead of a checklist. A
park you haven't been to shows its badge **outlined**; one you have shows it **in color**. Tapping a
badge opens a flyout with the badge large, **how many times** you've been and **every visit's
dates**, and the park's **hikes in a collapsible section** below. It should feel like Apple Watch
activity awards: a wall of badges that fill in as you earn them, each one a small object you can
pick up and turn over.

Nothing new is saved: like achievements, badges are worked out from your trips (`parkVisits`,
`hikesDone`), so they're always right after an edit, an Undo or a sync.

## 1. The artwork (decide first)

The request names Shutterstock's "national park logo" search as the image source. That doesn't
fit this app as it stands:

- **Licence.** Shutterstock images are licensed per download. Their standard licences don't
  allow making the files available for others to download or reuse, and this app's repo is public
  (`CatherineGu16/Travel-Log`) and so is the site (GitHub Pages): any badge image we bundle can be
  downloaded by anyone. Covering that would need each image's licence checked (likely an
  extended one), paid for, and the files kept out of the public repo.
- **No set of 64.** The search is mostly generic "national park" emblems and templates from
  many artists, not one consistent badge per park. Mixed styles would look like a sticker pile, not
  a badge wall.
- **"Outlined if not visited" needs two versions of every image.** A colored raster image has no
  outline to fall back to, so each one would need a second, hand-made outline version.
- **Not the NPS arrowhead.** It's a registered emblem of the National Park Service; it can't be
  used as a badge.

| Option | What it is | Cost / risk |
|---|---|---|
| **A. Our own SVG badges (recommended)** | One illustration per park in one style: the park's landmark (Delicate Arch, Half Dome, Old Faithful, the Narrows…) inside a shared frame, as simple line art with a few fill regions. **Outlined** = the same SVG drawn with strokes only, muted; **colored** = its fills on, in the park's own palette. Ours to publish, no outside request. | Drawing 64 landmarks. Done in batches (§5); a placeholder badge (frame + initials + a generic mountain) stands in until a park's art exists, so the grid ships first. |
| B. Buy a licensed set | One artist's matching set of US national park badges (vector, so an outline version can be made), with a licence that allows use in an app. Files kept in a private repo and pulled in by the build (a CI secret), never committed to the public one. | Paying for it, checking that the licence covers a public website, and the build setup. Outline versions still made by hand. |
| C. Photos | A public-domain NPS photo per park, cropped into the badge frame, grayscale when not visited. | Easiest art, but photos read as thumbnails, not badges, and add ~1–2 MB. |

**Recommendation: A**, with placeholders first (§5). If you'd like the look of a particular
Shutterstock set, it can be the style reference for the drawings, without using its files.

## 2. The grid (You › Parks)

- **Header** as now: "National parks", **14 / 64 visited**, the progress bar, Show (All · Visited ·
  Not visited) and Order (A–Z · State · **Recent**, newest visit first). By State, each state is a
  heading over its own grid.
- **Grid**: `grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr))`, so 3 across on a
  390 px phone, 5–6 in the desktop section, 8+ wide. Each cell is one button (≥ 44 px, in fact
  ~104 px), read out as "Zion, visited 3 times" or "Acadia, not visited".
- **A badge cell**: the badge (circle frame, ~84 px), the park's short name under it (two lines,
  no cut-off), and one small line: **"3×" or the year** when visited, nothing when not.
  - **Not visited**: outline art in `--muted` on `--raised`, no fill, no shadow: present but
    clearly not earned.
  - **Visited**: full color, a soft shadow and a faint sheen across it (like Apple's metal
    badges); a small count chip at the top right from 2 visits on ("×3").
  - **Newly visited** (a park first visited on the trip you just saved): the badge "lands" the next
    time the grid shows it (outline → color, a scale bounce), once.
- **Log a visit** moves into the flyout (it doesn't fit a badge cell).
- Reduced motion: no sheen sweep, bounce or spin; badges just switch.

## 3. The flyout (a badge tapped)

The existing park sheet (`ParkSheet.tsx`, a `Sheet`: up from the bottom on phones, from the right on
wider screens), redesigned top to bottom:

1. **The badge, large** (~180 px), with the Apple Watch touch: **drag it sideways to spin it** in
   3D (CSS `rotateY`, following your finger, settling front or back when you let go); the **back**
   is engraved with "First visited" and the date and your visit count. Tapping it flips it. Not
   visited: the outline badge, and "Not visited yet" on the back. (Keyboard: a "Turn over" button.)
2. **The name and a one-line summary**: "Zion National Park · UT", then **"Visited 3 times ·
   first in 2016"**, or "Not visited yet" with **Log a visit**.
3. **Visits**: each visit, newest first: its dates (the days at the park if the stop has its own,
   else the trip's), the trip's title as a link (opens it on the map), and who went (faces).
4. **Hikes (collapsible)**, a disclosure row "Hikes · 4 done · 31 in this park":
   - **Hikes you've done**, each with its dates and trip (as now), Remove.
   - **All hikes in this park**: the NPS list and the ones people added, as corrected, A–Z, with
     distance, time, difficulty and the nps.gov link; ones you've done are checked. Tapping one
     adds it to a visit (asking which when there are several), so it doubles as **Add a hike**;
     the search box stays above it for hikes not listed.
   - Closed by default when the park has more than ~8 hikes (Glacier has 74); remembered per
     device.
   - The owner's **Correct the hike suggestions** stays at the very bottom.

Open questions: whether "Hikes" should instead (or also) sit under the grid on the Parks page, and
whether the badge's back should show anything else (miles hiked there, nights).

## 4. Counting

- **Times visited** = trips that include the park (`parkVisits`): two stops at Zion on one trip
  count once; two trips count twice.
- **First visited** = the earliest of those, by the park stop's own dates if set, else the trip's.
- **Visited** (colored) = at least one trip that has started (today or earlier). A trip still to
  come doesn't fill the badge early; the cell says "Planned · Jun 2027" instead. *(Decide: today
  every trip counts, planned or not.)*

## 5. Build order

1. **Grid with placeholder badges**: `ParkBadge.tsx` (frame, initials, a generic landmark; outline
   and color states, count chip), the grid in `ParksSection.tsx`, Recent order, cell names. Tests:
   e2e for outlined vs colored, the count, filters, opening a park (update `parks.spec.ts`,
   which finds rows by `listitem` name today).
2. **Flyout redesign**: the large badge with flip and drag-to-spin, summary, Visits with trip links,
   the collapsible Hikes with the full list (done ones checked, tap to add). Unit tests for the
   counting rules in `derive.ts`.
3. **Artwork**, per the decision in §1. With A: one SVG per park in `src/assets/park-badges/`
   (`<park-id>.svg`, line art with `class="fill"` regions), loaded as one lazy chunk with the
   Parks section (~3 KB each, ~200 KB total), in batches of ~10, most visited parks first; parks
   without art keep the placeholder.
4. **Celebration**: a save that first visits a park shows the badge in the message ("🏅 New badge:
   Zion"), like tier achievements, and the grid plays its "land" once.
5. Docs (this file, ui-lists.md, CLAUDE.md code map) and screenshots at 390 px and desktop.

## Files

- New: `src/components/ParkBadge.tsx` (the badge: art, outline/color, spin), `src/assets/park-badges/`.
- Changed: `ParksSection.tsx` (grid), `ParkSheet.tsx` (flyout), `derive.ts` (first visit, counts),
  `e2e/parks.spec.ts`.
- No change to the saved format, sync or `parseTravelData`.
