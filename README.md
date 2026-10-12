# Pig Inspection – Android app

Daily pig inspection app for the farm. Every phone saves to the UGREEN NAS over
WebDAV over HTTPS (published by Tailscale Funnel running on the NAS), so all operatives
share one set of records. Nothing extra is installed on the phones.

## What it does

- **Inspect**: checks, feed, dead pigs, medication, rodent control and location for each area.
- **Pigs**: pig numbers per area and in total. Dead pigs from inspections are taken off automatically.
  You can record stock counts, pigs in, moves between areas, and pigs sold or out.
- **History**: every inspection from every phone, pigs still in withdrawal, and a WhatsApp send.
- **Stats**: mortality %, medication %, checks completed, missed days, rodent sightings,
  medicine used and operative performance, by week or month and by area.
- **Meds**: medication stock with use-by and withdrawal dates, plus a symptoms and dosage guide.
- **More**: NAS connection, sync status, operatives and CSV export.

## Files on the NAS (inside `PigReports`)

| Folder | Contents |
|---|---|
| `app-data/inspections/` | one `.json` file per inspection (the app's records – don't edit) |
| `app-data/movements/` | pig-number entries |
| `app-data/settings/` | operatives, medications and poisons lists |
| `Reports/<year>/<year-month>/` | a PDF report for every inspection |
| `Exports/` | CSV exports |

## Worker and manager versions

Every build makes two apps from the same code:

- **PigInspection.apk** – worker version. Can't record, change or delete pig numbers, and can't delete inspections.
- **PigInspection-Manager.apk** – full version.

The only difference is `FARM_ROLE` in `www/config.js`.

## Building

Every push to `main` builds the app on GitHub Actions. The `.apk` is attached to a
new release under **Releases**. To install it, open it on the phone. To update, install
the newer `.apk` over the top; data on the phone and the NAS is kept.

The build does `npx cap add android`, then `android-custom/apply.sh` adds the native
WebDAV/location plugin, allows plain HTTP for a NAS on the local network, and signs
the app with `keystore/debug.keystore`. Every build uses that same key so updates install cleanly.

The web app is `www/`. It's plain HTML/JS with no build step. To test it in a browser,
serve `www/` and a WebDAV folder from the same address.
