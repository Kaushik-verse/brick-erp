# Brick ERP (Jaya Vasavi Industries)

A fully responsive, offline-first Enterprise Resource Planning (ERP) application designed specifically for Brick Manufacturing factories. Built with React, Vite, Tailwind CSS, and Capacitor.

## Core Features
- **Offline-First**: Uses local Dexie.js database to operate completely offline without an internet connection.
- **Cross-Platform**: Runs beautifully as a Mobile Android App and as a fully responsive Desktop Web App.
- **Cloud Backup**: Automated daily Google Drive database backups and manual sync capabilities.
- **Production Engine**: Track raw material consumption and finished brick production based on exact recipes (fractional calculations supported).
- **Smart Invoicing**: Generate professional PDF invoices (Statements and individual Bills) with customizable branding, terms, and QR codes.
- **Sales & Receivables**: Manage customer ledgers, handle split payments (Cash, Bank, UPI, Credit), and track outstanding balances.
- **Purchases & Payables**: Manage supplier ledgers and inventory.
- **Expense Tracking**: Log and categorize daily factory expenses (Fuel, Maintenance, Labour, etc.) with automated dashboard deductions.
- **WhatsApp Integration**: Send one-click payment reminders and PDF invoices directly via WhatsApp.

## Dashboard Metrics Explained
The ERP features a real-time dashboard to give a bird's-eye view of the factory's financial health:
- **Net Cash Position**: The overall balance of money flowing in vs. out for the month.
- **Cash In**: Money received physically in cash.
- **Bank In**: Money received directly into the bank account (UPI/Transfers).
- **Cash Out**: Money spent physically in cash (for expenses or supplier payments).
- **Total Sales**: The total bill value of all bricks sold this month (including unpaid credit sales).
- **Collected**: The total amount of money actually received from customers this month.
- **Receivables**: Money that customers still owe the factory (outstanding balances).
- **Payables**: Money owed to suppliers for raw materials.
- **Bricks Produced**: The total number of bricks manufactured in the factory this month.
- **Gross Margin**: Estimated basic profit for the month (Total Sales minus the cost of the raw materials used).
- **Finished Stock Value**: The estimated total worth of all the ready-to-sell bricks currently in the factory yard.

## Application Pages & Navigation
- **Dashboard (`/`)**: The main landing screen with KPI cards, net cash position, production charts, and aging alerts.
- **Sales & Customers (`/sales`)**: Manage all customer accounts, view outstanding balances, record new sales, and generate customer ledger statements.
- **Purchases & Suppliers (`/purchases`)**: Manage supplier accounts, record raw material purchases, and track supplier payables.
- **Production (`/production`)**: Log daily brick production, automatically consume raw materials based on recipes, and track per-brick manufacturing costs (including labour).
- **Inventory (`/inventory`)**: Monitor real-time stock levels of Raw Materials (Fly Ash, Lime, Gypsum, Quarry Dust) and Finished Stock (4-inch, 8-inch, 9-inch bricks).
- **Expenses (`/expenses`)**: Record daily cash leakage and operational costs (Machinery Repair, Fuel, General Charges). Includes deletion support.
- **Invoice Builder (`/invoice-builder`)**: A dedicated screen to construct detailed professional invoices, add transport/loading charges, and export as PDF.
- **More / Settings (`/more`)**: Access system configuration.
  - **Drive Sync (`/sync`)**: Manage Google Drive backups.
  - **Master Settings (`/settings`)**: Configure factory details, bank accounts, and invoice toggles (e.g., show/hide transport charges, QR codes).
  - **Recipe Management (`/recipes`)**: Define the exact raw material quantities required to manufacture a single brick of each size.

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
npm run android:build
```
Open Android Studio to compile the APK, or run:
```bash
cd android
./gradlew assembleDebug
```
