# Aerovhyn Inventory & Asset Management

Fresh local-first project foundation for VS Code. The application uses a vanilla HTML/CSS/JS frontend, a Node.js API handler, local JSON files during development, and Netlify Blobs for deployed persistence. No relational database is required.

## 1. Requirements

- Node.js 20 or newer (Node 22 recommended)
- VS Code
- Git (for later GitHub deployment)

## 2. Run locally

1. Extract this ZIP.
2. Open the extracted `aerovhyn-inventory` folder in VS Code.
3. Open Terminal in VS Code.
4. Run:

```bash
npm install
npm run dev
```

5. Open http://localhost:8888

The local API reads and writes JSON files in `/data`. Your local data is therefore inspectable and can be backed up as ordinary files.

## 3. Initial local accounts

| Username | Password | Role |
|---|---|---|
| admin | Avhyn@Admin2026 | admin |
| team | Avhyn@Team2026 | staff |
| store | Avhyn@Store2026 | manager |
| engineering | Avhyn@Eng2026 | staff |
| procurement | Avhyn@Proc2026 | manager |
| technician | Avhyn@Tech2026 | staff |
| projectlead | Avhyn@Project2026 | manager |
| auditor | Avhyn@Audit2026 | viewer |

These are bootstrap credentials for local development only. Change them before any production use. Passwords are currently stored as plain text in `data/users.json` for local ease; this is NOT suitable for production. Before deployment, migrate passwords to secure hashes and move all secrets out of the repository.

## 4. Data files

- `data/assets.json` — fixed assets
- `data/stock.json` — consumable stock
- `data/locations.json` — office, rack, shelf, bin hierarchy
- `data/projects.json` — projects
- `data/procurement.json` — purchase orders, invoices and warranty metadata
- `data/maintenance.json` — maintenance tasks and service records
- `data/activity.json` — audit activity
- `data/users.json` — local user accounts
- `data/settings.json` — application settings

## 5. Netlify deployment architecture

The frontend is static. `/api/*` is rewritten to `netlify/functions/api.mjs`. In deployed Netlify Functions, the API stores each collection as a JSON object in Netlify Blobs. Locally, `server.mjs` stores collections in the `/data` directory.

This keeps the same API and data model in local and deployed environments without a database server. Netlify Blobs is persistent object storage, not a relational database. For a seven-person office with modest concurrent writes this is a reasonable first deployment pattern, but it does not provide database transactions or relational constraints.

Before deploying:
- Do not commit real passwords, secrets, invoice documents, or confidential inventory data.
- Replace the bootstrap login implementation with salted password hashes.
- Set a strong `AUTH_SECRET` in Netlify environment variables.
- Configure Netlify Blobs and verify persistence with a test record across redeployments.
- Add role-based authorization checks to every write operation.
- Add concurrency protection for simultaneous stock changes.
- Configure backups and test restore.
- Decide on file attachment storage and upload size limits; current procurement module stores invoice references/metadata only, not uploaded files.

## 6. Current application scope

Included in this first local build:
- Login/session foundation
- Dashboard and inventory valuation
- Fixed asset register
- Consumable stock register
- Locations and bins
- Project register
- Procurement and invoice metadata
- Maintenance task register
- Audit activity
- User list display
- Create, edit and delete for the operational registers

Planned hardening before production:
- Password hashing and account administration
- Fine-grained role permissions and server-side authorization
- Stock movement ledger (inward/outward/returns/adjustments)
- Asset assignment and project allocation workflows
- Purchase invoice file upload and secure storage
- QR label generation/scanning
- Maintenance recurrence engine and due reminders
- Export/backup/restore
- Optimistic concurrency controls and automated tests

Do not treat the application as production-approved until the hardening checklist is completed and tested.
