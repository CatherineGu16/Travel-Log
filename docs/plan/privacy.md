<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Privacy and security

Same rules as Watchlist-Tracker, plus map rules:

- **Strangers** who open the site get an empty map with public data only (states, national
  parks). They cannot see your trips without your token.
- **The token** is stored only in the device's local storage for this site. It is never committed,
  logged, or sent anywhere except `api.github.com`. It grants access to `travel-data` and, for
  sharing hikes you add, `Travel-Log` (see **Shared hike suggestions** in data.md). Use a
  **separate token from Watchlist's**, so revoking one doesn't break the other.
- **Outside map requests: none by default.** The outline map and place search run entirely from
  bundled files. Only when you turn on the detailed map does the app contact OpenFreeMap (tiles)
  and Photon (search). They see which area you're viewing or what you typed into search, but
  never your token or trips.
- **Hardening**: strict Content Security Policy:
  `connect-src 'self' https://api.github.com https://tiles.openfreemap.org https://photon.komoot.io`
  (the two map domains are allowed so the optional setting can work, but the app never calls them
  while it's off),
  `img-src 'self' data: blob:` (blob: for avatar photos), and `worker-src 'self' blob:` (MapLibre needs this). No analytics, ads or
  third-party scripts. Fonts and libraries are bundled at build time.
- **Lost device / expired token**: same as Watchlist. Revoke or regenerate the token. Nothing is
  lost. Local data is kept and merges back once reconnected.
- **Avatar photos are never public.** They live in the private repo, are downloaded with the
  token and shown from local blob URLs, and are re-encoded before upload, which strips EXIF and
  GPS data.
- **Repo hygiene**: `data/private/` is git-ignored for any local exports.
