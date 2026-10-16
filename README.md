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
- **Meds**: medication stock in bottles and ml left, use-by and withdrawal dates, plus a symptoms and dosage guide.
- **More**: who's signed in, farm setup, NAS connection, sync status, users and permissions, and CSV export.

## Files on the NAS (inside `PigReports`)

| Folder | Contents |
|---|---|
| `app-data/inspections/` | one `.json` file per inspection (the app's records – don't edit) |
| `app-data/movements/` | pig-number entries |
| `app-data/settings/` | users and permissions, operatives, medications and poisons lists |
| `Reports/<year>/<year-month>/` | a PDF report for every inspection, and a `Photos` folder |
| `Exports/` | CSV exports |

## Admin and user permissions

There is one app for everyone. Each person signs in with their name and a PIN (4–6 numbers);
the first time they sign in they choose their own PIN. The phone stays signed in until **Sign out** in Settings.

| | Admin | User |
|---|---|---|
| New inspections, with photos | ✔ (any operative's name) | ✔ (own name only) |
| View history, pig numbers, stats, medications | ✔ | ✔ |
| WhatsApp report, re-send PDF, CSV export | ✔ | ✔ |
| Record or remove pig numbers | ✔ | – |
| Delete inspections | ✔ | – |
| Add or change medications and poisons | ✔ | – |
| Add or remove users, change permissions, reset PINs | ✔ | – |
| Change the NAS connection | ✔ | – |

The list is stored on the NAS in `app-data/settings/accounts.json` (PINs are stored hashed, never as typed).
The first time this version reaches the NAS it makes the list from the existing operatives:
Wayne McFarlane is admin and everyone else is a user.

The PIN stops people using each other's name and keeps users out of admin screens. It is not strong
security – anyone with the NAS password can still edit the files on the NAS.

## Farm setup (admin)

Settings → **Farm setup** names each shed or area and records its equipment. The tick boxes come from it:

| Equipment | Adds |
|---|---|
| Trough drinkers | Drinkers checked, **Drinkers cleaned** |
| Nipple drinkers | Drinkers checked, **Nipples operational** |
| Auto feed system | Auto feed system active, Feed hopper checked |
| Manual feeders | Feed hopper checked, Feed added |

Every area also has Bedding OK / Bedding required and rodent control. The first time an admin signs in,
the app opens this menu. Saved inspections keep the layout they were made with, and removed areas stay
in old records and pig numbers. Stored in `app-data/settings/areas.json`.

## Medication stock

Each medication records its bottle size (ml) and number of bottles. The app shows the total, the ml used
by saved inspections (same name and batch, since it was added) and the ml left, warns when it's running low
or an inspection would use more than is left, and **Add bottles** tops it up. The medication reason list only
offers reasons that match what the medicine is used for (plus Other).



Every tick box (and the rodent evidence and restock boxes) has a camera button to its right. Photos are
shrunk to 1280 px, shown under the area, saved on the NAS in `Reports/<year>/<year-month>/Photos/`
and printed in the PDF report.

## Building

Every push to `main` builds the app on GitHub Actions. The `.apk` is attached to a
new release under **Releases**. To install it, open it on the phone. To update, install
the newer `.apk` over the top; data on the phone and the NAS is kept.

The build does `npx cap add android`, then `android-custom/apply.sh` adds the native
WebDAV/location plugin, allows plain HTTP for a NAS on the local network, and signs
the app with `keystore/debug.keystore`. Every build uses that same key so updates install cleanly.

The web app is `www/`. It's plain HTML/JS with no build step. To test it in a browser,
serve `www/` and a WebDAV folder from the same address.
