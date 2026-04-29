# Jointly

Offline-first, local-only, privacy-focused cross-platform desktop budgeting app for multi-member households.

## Stack

- **Desktop shell:** Electron
- **Renderer:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Validation:** Zod
- **Storage:** SQLite via `better-sqlite3` (main process only)
- **Packaging:** `electron-builder`

## Security & Architecture

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer never touches SQLite/filesystem directly.
- All database and file operations go through typed IPC + preload bridge.
- Zod validation is applied on IPC payloads.

High-level folders:

- `main/` Electron main process, DB and services
- `preload/` secure IPC bridge exposed to renderer
- `renderer/` React application
- `shared/` shared contracts (types, schemas, channel names)

## Implemented Core Foundations

- Project scaffolding with Electron + Vite integration
- SQLite initialization, migrations, and default seed categories
- Required tables:
  - `members`, `joints`, `accounts`, `categories`, `transactions`,
  - `recurring_rules`, `contribution_settings`, `generation_log`, `attachments`, `settings`
- Main-process service layer:
  - `dbService`, `transactionService`, `recurringService`, `contributionService`,
  - `generationService`, `attachmentService`, `aiService`, plus member/account/report/settings services
- Initial app shell UI with sidebar routes and IPC-wired bootstrap data

## Implementation Status (Delivery Order)

- ✅ Repo scaffolding + Electron boot
- ✅ SQLite schema + migrations + seed data
- ✅ Members + Accounts (CRUD)
- ✅ Transactions (income, expense, transfer)
- ✅ Recurring + month generation (preview + commit, idempotent)
- ✅ Joint contribution logic (settings + expected vs actual)
- ✅ Attachments (transaction-level attach/list via local filesystem storage)
- ✅ Reports (summary, category/member breakdown, trends)
- ✅ AI integration (provider config + connectivity tests with graceful fallback)
- ✅ Polishing + documentation updates

## Current UI Coverage

- **Members:** add/edit members, active flag, color metadata, contribution settings editor
- **Accounts:** add/edit personal and joint accounts (checking/savings/credit card), current balance display
- **Transactions:** create income/expense/transfer, filters, attachment management panel
- **Recurring:** rule CRUD for expense/income/contribution recurring items
- **Month View:** explicit preview/commit monthly generation workflow
- **Reports:** monthly summary + category/member/joint/trend breakdowns
- **Settings:** app data path visibility, AI provider settings, connectivity test, JSON export snapshot, CSV import

## Credit Card Workflow

Jointly models credit card behavior with deterministic transaction flows:

- Record card purchases as regular **expense** transactions on the **credit_card** account.
- Record monthly payoff as a **transfer** from a funding account (checking/savings) to the credit card account.

In the Accounts screen:

- Create account type `credit_card` for each card.
- Credit card balances are shown as **Amount Owed** semantics.
- Use the built-in **Pay Credit Card** quick action to generate the transfer transaction safely.

This ensures expenses are counted at purchase time, while payoff is treated as money movement (not double-counted expense).

## Notes on Scope / Next Refinements

- Current renderer is intentionally consolidated in `renderer/src/App.tsx` for rapid iterative delivery.
- Next maintainability step: split route modules into dedicated files/components.
- Import workflow is currently marked planned in UI (export is implemented).

## Development

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Type-check:

```bash
npm run typecheck
```

Build renderer + electron bundles:

```bash
npm run build:renderer
```

Create packaged desktop builds:

```bash
npm run build
```

## Local Data Paths

In packaged apps, data is stored under the OS appData directory in:

- `{appData}/Jointly/jointly.sqlite`
- `{appData}/Jointly/storage/...`

In local development, appData is redirected to:

- `./.appdata/Jointly/...`

to keep all data inside the project workspace.

## Notes

- Month generation is explicit and user-triggered (no silent auto-generation).
- Generation uses `generation_log` for idempotency.
- AI integration is optional and degrades gracefully when unavailable.
