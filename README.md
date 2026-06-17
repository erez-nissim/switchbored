# SwitchBored — backend

A real Node/Express backend for the cross-game trading marketplace. All business
logic lives here: auth, the 50% price cap, Market Gold escrow (hold on buy,
release on delivery, refund on cancel), search/sort, and the trade lifecycle.
The frontend (`index.html`) is a thin client that just renders what the API
returns.

## Requirements
- Node.js 18 or newer (no native build steps, nothing to compile).

## Run it
```bash
cd switchbored-server
npm install
npm start          # -> SwitchBored API on http://localhost:3000
```
On first start it creates `data.json` and seeds 3 sample games with products.
Use `npm run dev` to auto-restart on file changes.

Then open `../index.html` in a browser. It defaults to `http://localhost:3000/api`
(set `API_BASE` at the top of the `<script>` if you host the server elsewhere).

## Configuration (optional)
Copy `.env.example` to `.env`:
- `PORT` — server port (default 3000).
- `JWT_SECRET` — set this to a long random string for anything real.
- `SMTP_*` / `MAIL_FROM` — real email. Without these, the seller/buyer
  notifications print to the server console (so the full flow still works in dev).

## Loading a catalog (e.g. the full D2R item list)
`d2r-catalog.csv` is a curated, trade-relevant Diablo II Resurrected catalog (~183
items: runes, runewords, key uniques/sets, charms, endgame items, popular bases).
`cost_in_game` is a reference value approximating relative d2jsp Forum Gold market
value, scaled to sensible Market Gold amounts — edit it freely (it drives the 50%
price cap). The CSV opens in any spreadsheet.

Load it with the server **stopped** (the running server would overwrite the import):
```bash
node import.js --reset     # replace the D2R catalog with the CSV, then:
npm start
```
- `--reset` wipes that game's products first (use it the first time, to drop the
  3 sample items). Without `--reset` it adds new items and updates existing ones
  by name — handy for re-running after a seasonal price edit.
- Other games: `node import.js --game "Warframe" --file warframe-catalog.csv`.
- Blank `image` cells get an auto placeholder (item icons are Blizzard IP).

## Tests
```bash
node selftest.js   # exercises the logic directly (auth, cap, escrow, refund, rollback)
node httptest.js   # exercises the live HTTP API end to end
```

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | – | create account → `{token, user}` |
| POST | `/api/auth/login` | – | log in → `{token, user}` |
| GET | `/api/me` | yes | current user + MG balance |
| GET | `/api/games` | – | supported games |
| GET | `/api/games/:id/products?q=` | – | catalog search (Sell) |
| GET | `/api/games/:id/listings?q=` | – | open listings (Buy) |
| GET | `/api/games/:id/activity` | – | recent activity feed |
| POST | `/api/games/:id/products` | yes | add a catalog item |
| POST | `/api/games/:id/listings` | yes | list an item (enforces 50% cap) |
| POST | `/api/trades/:id/buy` | yes | buy (escrow MG, email seller) |
| POST | `/api/trades/:id/deliver` | yes | seller confirms (release MG, email buyer) |
| POST | `/api/trades/:id/cancel` | yes | cancel (refund buyer if in progress) |
| GET | `/api/me/trades` | yes | buyer + seller dashboard |
| POST | `/api/me/topup` | yes | simulated "buy more gold" |

## Files
- `server.js` — Express routes (HTTP only).
- `services.js` — business logic, validation, search/sort/joins, money ops.
- `db.js` — storage. A zero-dependency JSON-file store today; reimplement these
  exports to move to SQLite/Postgres without touching the rest.
- `auth.js` — bcrypt hashing + JWT sessions.
- `email.js` — notifications (SMTP or console).
- `import.js` — bulk-load a catalog CSV into a game's products.
- `d2r-catalog.csv` — the curated Diablo II Resurrected item catalog.

## Notes before real use
- **Storage**: the JSON store is single-process and fine for a self-hosted v1
  (money ops are synchronous, so a buy is atomic). For multiple instances or real
  scale, swap `db.js` to Postgres or SQLite.
- **Payments**: "buy more gold" is a stub — no real payment yet.
- **CORS**: currently open to any origin (`cors()`); restrict it for production.
- **Secrets**: set `JWT_SECRET`, and use real SMTP for live email.
