# IndiaEye website: two editing options, one site

One Astro site (English + Hindi, language toggle in the header). The pages are identical in both options;
only **how staff edit content** differs.

| | Option A: Decap CMS | Option B: Notion |
|---|---|---|
| Staff edit in | Browser form at `/admin` | Notion pages |
| Staff need | A GitHub account (one-time invite) | A Notion account |
| Publishes | Instantly on save (Git commit, rebuild ~1 min) | Within ~30 min (scheduled rebuild) |
| Hindi/English | Side-by-side fields in one editor | A page per language, linked by the same Slug |
| Setup effort | OAuth proxy Worker for GitHub login | Notion integration + deploy hook |

## Run locally

```bash
npm install
npm run dev            # site at http://localhost:4321
```

### Option A: Decap
```bash
npx decap-server       # second terminal
```
Open http://localhost:4321/admin. No login needed locally (`local_backend: true`). Edit a page in English and Hindi, save, and the dev site updates.

### Option B: Notion
1. Create a Notion database with these properties: **Name** (title), **Slug** (text), **Language** (select: `en`, `hi`), **Order** (number), **Show in menu** (checkbox), **Summary** (text), **Published** (checkbox). The page body is the content.
2. Create an integration at notion.so/profile/integrations, then share the database with it ("Connections").
3. Copy `.env.example` to `.env` and fill in the token and database ID.
4. `npm run dev:notion` (sync + dev) or `npm run build:notion`.

Each page needs a row per language with the **same Slug** (`about` in `en` and `hi`). The toggle uses that to jump to the translation.

## Deploy to Cloudflare Pages
- Connect the Git repo. Output directory: `dist`.
- Option A build command: `npm run build`. Option B: `npm run build:notion`, with `NOTION_TOKEN` and `NOTION_DATABASE_ID` as environment variables.
- Custom domain: add `indiaeye.com` in the Pages project (the domain's DNS must be on Cloudflare, which is free).
- Option A login in production: deploy a small GitHub OAuth proxy as a Worker (search for "Decap CMS OAuth Cloudflare Worker"), then put its URL in `public/admin/config.yml` (`base_url`) and set `repo`.
- Option B auto-rebuild: create a Deploy Hook in Pages, save it as the repo secret `CF_DEPLOY_HOOK_URL`; `.github/workflows/notion-rebuild.yml` calls it every 30 minutes.

## Status of this proof of concept
- Site, bilingual routing and toggle: built and verified (`npm run build`).
- Decap config and Notion sync script: written but **not tested against a live GitHub repo / Notion workspace**. Expect small fixes on first run.
- All text is placeholder; Hindi copy should be reviewed by a native speaker.
