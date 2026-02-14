# Vercel Configuration & Recovery Guide

## 1. Directory Structure (JST: 2026-02-14)
The project has been flattened to the root directory for standard Vercel deployment.

```
/ (Root)
├── api/                # Serverless Functions
│   ├── cron.js         # Main cron handler
│   ├── go.js           # Redirect & tracking handler
│   └── ...
├── src/                # Core Logic & Services
│   ├── services/
│   └── utils/
├── public/             # Static Assets (Admin, Apply pages)
├── vercel.json         # Vercel Routing & Config
└── package.json        # Dependencies
```

## 2. Standard vercel.json
If you experience 404 errors, ensure `vercel.json` at the root matches this:

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/cron", "destination": "/api/cron.js" },
    { "source": "/go", "destination": "/api/go.js" },
    { "source": "/admin", "destination": "/public/admin.html" },
    { "source": "/apply", "destination": "/public/apply.html" },
    { "source": "/", "destination": "/api/go.js" }
  ]
}
```

## 3. Recovery Procedure
If the deployment breaks:
1. Ensure all files are in the root (not in `04_code` folder).
2. Check if `api/` and `public/` directories are tracked by git (`git ls-files`).
3. Verify that `package.json` has `engines: { "node": ">=18.x" }`.
4. Force push to main: `git push -f origin main`.

## 4. Vercel Dashboard Settings
- **Framework Preset**: Other (or None)
- **Root Directory**: Leave empty (default to root)
- **Environment Variables**: Ensure `ADMIN_PASSWORD`, `GOOGLE_SHEET_ID`, etc., are set in the dashboard.
