<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Sync

Same engine as Watchlist-Tracker (`src/sync/`).

1. **On open / on focus / on reconnect**: `GET .../contents/travel.json`. Merge it into the local
   copy and remember the file's `sha`.
2. **On change**: apply locally right away (IndexedDB), then debounce ~3 s and
   `PUT .../contents/travel.json` with the last known `sha`. Quick edits are batched into one
   commit.
3. **Conflict** (409/422 because another device saved first): re-fetch, merge, retry. Merges go
   record by record (`id` + `updatedAt`) for trips, places, people and groups, with tombstones
   for deletes.
   Unsynced edits are tracked with a flag, as in Watchlist.
4. **Avatar photos**: uploaded with a single `PUT .../contents/avatars/{id}.jpg` **before** the
   `travel.json` that points to them, so another device never sees a photo avatar without its
   file. Downloaded once per device and cached in IndexedDB. Replacing a photo overwrites the
   file and bumps `photoUpdatedAt`. Until a photo has downloaded, the initials avatar shows.
   On the device, photos are kept in IndexedDB as bytes (Safari won't store Blobs there in private
   browsing).
5. **Offline**: edits and avatar uploads stay queued and push when the connection returns.
6. **Status chip** in the header: Synced / Saving / Syncing / Offline / Sync problem.
7. **First-time setup** (once per device): Settings → Sync across devices → username, repo, key,
   device name. If `travel.json` doesn't exist, the app creates it from the local data.
8. **Without a token**, the app still works fully on that one device and offers Export/Import
   (a .zip with `travel.json` + avatar photos).
