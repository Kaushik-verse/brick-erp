# Brick ERP 2.0 — Safe Upgrade Guide

This version adds **automatic backups** and fixes several bugs that could lose or
mis-count data. Follow these steps **in order** to install it on Dad's phone
without losing any of the existing data.

## Before you install (important)

The data lives **inside the app** on the phone. Uninstalling the app deletes it.

1. On Dad's phone, open the **current** app.
2. Go to **More → Google Drive Backup / Backup & Restore**.
3. Tap **Export Backup** and send the file to yourself on WhatsApp or email.
   Keep it safe. It is your guarantee if anything goes wrong.

## Install the update

1. Build the APK on **this same Mac** (it signs the app with this Mac's key,
   `~/.android/debug.keystore`):
   ```bash
   npm run android:build
   cd android && ./gradlew assembleDebug
   ```
   The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
2. Copy the APK to the phone and open it. Choose **Update**.
   - **Never uninstall the old app first.**
   - If Android says *"App not installed"* or *"package conflicts"*, the old
     app was signed on a different computer. **Stop.** Don't uninstall unless
     you have the backup file from the step above. With that file you can
     uninstall, install the new APK, then use **More → Backup & Restore →
     Restore file**.
3. Open the app. All previous data should be there. The database upgrades
   itself automatically and nothing is deleted.

## After installing: turn on cloud backup (one time)

1. **More → Backup & Restore → Connect Google Drive**, then sign in with Dad's
   Google account.
2. That's it. From now on the app backs up by itself.

## How data is kept safe now

| Where | When | Survives |
|---|---|---|
| Phone storage: `Documents/BrickERP/Backups` (classic) or `Documents/FactoryBook/Backups` (Factory Book) | About 1 minute after every change, and whenever the app is closed | App crash, app data cleared, app uninstalled |
| Google Drive (private, hidden app folder) | Same as above, when internet is available | Phone lost, broken or stolen |
| Safety copy | Before every restore, factory reset or Excel import | Mistakes ("I restored the wrong file") |

- 30 days of daily backups **plus one backup for every month, kept forever**, on the
  phone **and** on Drive. If someone enters wrong data, you can go back to any day or month.
- The dashboard shows a green **Data backed up** line. If it turns orange
  ("Backup needs attention"), open it to see why. Usually it means no internet
  or the Google sign-in expired; tap **Back Up Now** or reconnect.

## Moving to a new phone

Install the app, open **More → Backup & Restore**, then either:
- **Connect Google Drive → Show Drive Backups → Restore**, or
- **Restore file** and pick a file from `Documents/BrickERP/Backups` (copied from
  the old phone) or from WhatsApp/email.

## Why not a server/backend?

A server costs money, needs maintenance, and must be kept secure. For one
user, Google Drive's private app folder gives free, automatic, off-phone
backups in the owner's own Google account. Nobody else can see the data.
If you later want **live sync between two devices** (for example the phone and a
laptop at the same time), the next step would be Firebase or Supabase (both have
free tiers). The backup format here already exports every table, so moving
the data there later is simple.

---

# Trying the new design ("Factory Book")

The new design is a **separate app**. It installs next to the classic app and
keeps its own data, so Dad's daily app is never affected.

| | Classic | New |
|---|---|---|
| Phone app name | Brick ERP | Factory Book |
| Build | `npm run android:build:classic` → `apk/BrickERP-Classic.apk` | `npm run android:build:new` → `apk/FactoryBook.apk` |
| Web preview | `npm run dev` (port 5173) | `npm run dev:new` (port 5174) |

**To try it with Dad's real data:**
1. In the classic app: More → Backup & Restore → **Export file**.
2. Install `FactoryBook.apk`, open it: More (grid icon on Home) → Backup & Restore → **Restore file**.

Entries made in one app do **not** appear in the other. Pick one app for daily
work. To switch for good, export from the old app and restore into the new one.

Note: Google Drive sign-in needs the new app id `com.brickworks.erp.newdesign`
added to the Google Cloud project (OAuth Android client). Until then the new app
still backs up to the phone automatically.
