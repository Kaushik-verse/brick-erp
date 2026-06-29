# Brick ERP

A fully responsive, offline-first Enterprise Resource Planning (ERP) application designed specifically for Brick Manufacturing factories. Built with React, Vite, Tailwind CSS, and Capacitor.

## Features
- **Offline-First**: Uses local Dexie.js database to operate completely offline.
- **Cross-Platform**: Runs beautifully as a Mobile Android App and as a fully responsive Desktop Web App.
- **Cloud Backup**: Automated daily Google Drive database backups.
- **Production Logs**: Track raw material consumption and finished brick production.
- **Sales & Receivables**: Manage customer ledgers and outstanding balances.
- **Purchases & Payables**: Manage supplier ledgers and inventory.
- **WhatsApp Integration**: Send one-click payment reminders directly via WhatsApp.

## Development Setup

### Install Dependencies
```bash
npm install
```

### Run Locally (Web)
```bash
npm run dev
```

### Build for Production (Web)
```bash
npm run build
```

### Build for Android (Capacitor)
```bash
npm run build
npx cap sync android
```
Open Android Studio to compile the APK, or run:
```bash
cd android
./gradlew assembleDebug
```
