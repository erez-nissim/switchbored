# SwitchBored — Cloud Setup Guide

## Quick Start

### Prerequisites
- **Node.js 18+** installed on your server
- **Port 3000** available (or modify in code)

### Step 1: Extract & Install

```bash
unzip switchbored.zip
cd switchbored/switchbored-server
npm install
```

### Step 2: Configure (Optional but Recommended)

Create a `.env` file in the `switchbored-server/` folder:

```
JWT_SECRET=your-very-secret-key-change-this
```

If you skip this, the app works but warns you on startup. For production, always set JWT_SECRET.

### Step 3: Start the Server

```bash
npm start
```

You should see:
```
⚙ Seeded sample games + products.
Server running on http://localhost:3000
```

### Step 4: Connect the Frontend

The frontend (`index.html`) is in the parent folder. Open it in a browser and update the API URL:

**If accessing from the same machine:**
- Keep `const API_BASE = "http://localhost:3000/api"`
- Open `index.html` in your browser

**If accessing from another machine (production):**
- Edit `index.html` and change the line at the top:
  ```javascript
  const API_BASE = "https://your-domain.com/api";
  ```
- Upload `index.html` to your web server (or serve it via Node — see below)

## Production: Serve Everything from One Domain

To avoid cross-origin issues and simplify access, serve both the API and frontend from your domain:

**Option A: Use Express to serve the frontend (simplest)**

Add this to the end of `server.js` before the `app.listen()` line:

```javascript
// Serve the frontend
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
```

Then update `index.html`:
```javascript
const API_BASE = "/api";  // same domain
```

Start the server and access it at `https://your-domain.com`.

**Option B: Use Nginx as a reverse proxy (recommended for production)**

Your Nginx config should point both `/api` → Node and `/` → static HTML:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location / {
        alias /path/to/switchbored/;
        try_files $uri /index.html;
    }
}
```

Update `index.html`:
```javascript
const API_BASE = "/api";
```

## Data & Persistence

- **All data** (accounts, games, items, trades) lives in `data.json` in the `switchbored-server/` folder
- **First run**: The app seeds sample games (Diablo II: Resurrected, Warframe, ESO) — edit or delete these via the UI
- **Backup**: Copy `data.json` regularly if you care about the data

## Maintenance

### Reset All Listings (keep accounts & catalog)
```bash
node reset-listings.js
```
(Stop the server first)

### Reset Everything
Delete `data.json` and restart — the app will re-seed sample data on next startup.

## Troubleshooting

**"Cannot GET /api/games"**
- Server isn't running, or the API_BASE URL in `index.html` is wrong

**"Address already in use"**
- Port 3000 is taken. Either kill the process using it, or change the port in `server.js` (line: `const PORT = 3000;`)

**"JWT_SECRET not set"**
- Optional warning. Set it in `.env` for production, but the app works without it for dev

**Listings look broken or "(removed)" after re-import**
- This is normal if you've imported the D2R catalog multiple times. Run `node reset-listings.js` to clean up

## Next Steps

- **Add real item icons**: Drop PNG/WebP files named after items into an `icons/` folder (e.g., `ber-rune.png`, `enigma.png`)
- **Customize games/catalog**: Edit the sample games in `db.js` or add them via the UI
- **Enable email notifications** (optional): Set `SMTP_*` env vars in `.env`

---

**Questions?** Check the README.md in the same folder or review `server.js` / `services.js` for the full API spec.
