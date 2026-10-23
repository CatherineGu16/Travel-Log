# Renewing the sync access key

The Travel Log app syncs between devices by saving your trips to the private repo
`CatherineGu16/travel-data`. It gets in with an **access key** you create on GitHub, and that key
expires on a date you pick (at most about a year out). When it expires, follow this page.

## What the access key is

A password-like code that GitHub calls a **fine-grained personal access token**. It starts with
`github_pat_`.

- **It can only touch one repo.** Set up as below, it reads and writes files in `travel-data` (`travel.json` and the `avatars/` photos)
  and nothing else: not your other repos, your account settings, or this public app repo.
- **It stays on your devices.** The app keeps it only on the device where you paste it and sends it
  only to GitHub.
- **GitHub shows it once.** If you lose it, don't hunt for it. Make a new one.

## What happens when it expires

Nothing is lost. Your trips keep working on every device; it just stops syncing between them until
you put in a new key.

1. **A few days before:** GitHub usually emails you that the token is about to expire.
2. **After it expires:** the next time a device tries to sync, GitHub rejects the key.
   - The header chip turns red and says **Sync problem**. Tap it to open Settings.
   - Settings → Sync shows: *"GitHub rejected the access key. It may have expired or been
     revoked."* with a **Create a key** link.
3. **Meanwhile, keep using the app.** New trips, edits, people and photos still save
   on that device right away. They're held until sync works again.
4. **Your trips on GitHub are untouched.** `travel.json` in `travel-data` stays exactly as the
   last successful sync left it.
5. **After you connect with a new key:** each device merges what it saved locally with what's on
   GitHub, so changes made on any device while the key was expired all come through.

If every device uses the same key, they all show **Sync problem** at the same time. If each device
has its own key, only the devices whose key expired do.

## 1. Create a new key on GitHub

1. Go to <https://github.com/settings/personal-access-tokens/new>.
   (Or: your profile photo → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.)
2. **Token name:** something you'll recognize, e.g. `Travel Log app 2027`.
3. **Expiration:** pick a date. The longest option is about a year. Put a reminder on your calendar
   a week before it.
4. **Repository access:** choose **Only select repositories**, then pick `travel-data`.
5. **Permissions → Repository permissions → Contents:** set to **Read and write**.
   Leave every other permission as it is. ("Metadata: Read-only" turns on by itself; that's fine.)
6. Click **Generate token**, then copy it. Paste it somewhere safe for the next step, such as your
   password manager. GitHub won't show it again.

**Shortcut:** instead of a new token, you can open the expired one on the
[fine-grained tokens page](https://github.com/settings/personal-access-tokens) and click
**Regenerate token**. It keeps the same repo and permission settings and gives you a new code and a
new expiration date.

## 2. Put the new key into the app, on each device

Do this on every device you use (iPhone, iPad, Windows PC, Mac).

1. Open the Travel Log app: <https://catherinegu16.github.io/Travel-Log/>.
   **On iPhone and iPad, open the installed app from your home screen, not Safari.** The installed
   app keeps its own storage, separate from Safari's.
2. Tap the gear icon (**Settings**) → **Sync** → **Disconnect…** → **Disconnect this device**.
   This only makes the device forget the old key. Your trips stay on the device and on GitHub.
3. Under **Sync across devices**, fill in:
   - **GitHub username:** `CatherineGu16`
   - **Private repo:** `travel-data`
   - **Access key:** paste the new key
   - **This device:** e.g. `iPhone` (it labels this device's saves in GitHub's history)
4. Tap **Connect**. It should say **Last synced just now**, and the header chip should turn green and
   say **Synced**.

## Cleaning up

- **Delete old keys** you no longer use on the
  [fine-grained tokens page](https://github.com/settings/personal-access-tokens). A key you delete
  stops working immediately.
- **Lost a device?** Delete that device's key right away (or the shared key, then give your other
  devices a new one). Nobody can read or change your trips or photos without a working key.
- **One key or one per device?** One key is less setup. One per device means that when you lose or
  replace a device, you delete just its key and the others keep working.

## If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| **Sync problem**, "GitHub rejected the access key" | Key expired, was deleted, or was pasted wrong | Make a new key (step 1) and reconnect (step 2) |
| "The access key isn't allowed to…" | The key doesn't have the right access to the repo | Check step 1.4 and 1.5: only `travel-data`, **Contents: Read and write** |
| "Repo not found, or the access key can't see it" | Typo in the username or repo name, or the key wasn't given that repo | Check `CatherineGu16` / `travel-data`, and step 1.4 |
| "…is public. Make it private on GitHub…" | `travel-data` was made public | On GitHub: `travel-data` → **Settings** → **Change visibility** → **Private**, then connect again |
| **Offline** | No internet connection | Nothing. It syncs when you're back online |

**Use a separate key from the Watchlist app's.** Each app gets its own key limited to its own data
repo, so revoking or renewing one never breaks the other.
