// Pulls published pages from a Notion database into src/content-notion/pages/{lang}/{slug}.md
// Database properties: Name (title), Slug (text), Language (select: en | hi), Order (number),
// Show in menu (checkbox), Summary (text), Published (checkbox)
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const NOTION_TOKEN = process.env.NOTION_TOKEN?.trim();
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID?.trim();

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error('Set NOTION_TOKEN and NOTION_DATABASE_ID (see .env.example).');
  process.exit(1);
}

const OUT = 'src/content-notion/pages';
const IMG_DIR = 'public/notion-images';
const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const text = (p) => (p?.rich_text ?? p?.title ?? []).map((t) => t.plain_text).join('');
const fm = (o) => '---\n' + Object.entries(o).filter(([, v]) => v !== undefined && v !== '')
  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n---\n\n';

// Notion image URLs expire after ~1 hour, so copy them into the site at build time.
async function localizeImages(md) {
  await fs.mkdir(IMG_DIR, { recursive: true });
  let out = md;
  for (const [full, alt, url] of md.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const u = new URL(url);
    const name = crypto.createHash('md5').update(u.pathname).digest('hex').slice(0, 12) + (path.extname(u.pathname) || '.jpg');
    const res = await fetch(url);
    if (!res.ok) { console.warn('Image download failed:', u.pathname); continue; }
    await fs.writeFile(path.join(IMG_DIR, name), Buffer.from(await res.arrayBuffer()));
    out = out.replace(full, `![${alt}](/notion-images/${name})`);
  }
  return out;
}

const rows = [];
let cursor;
do {
  const res = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    start_cursor: cursor,
    filter: { property: 'Published', checkbox: { equals: true } },
  });
  rows.push(...res.results);
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

await fs.rm(OUT, { recursive: true, force: true });
for (const row of rows) {
  const p = row.properties;
  const lang = p.Language?.select?.name;
  const slug = text(p.Slug);
  if (!['en', 'hi'].includes(lang) || !slug) { console.warn('Skipping (needs Language en/hi and a Slug):', text(p.Name)); continue; }
  const body = n2m.toMarkdownString(await n2m.pageToMarkdown(row.id)).parent ?? '';
  const file = path.join(OUT, lang, `${slug}.md`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, fm({
    title: text(p.Name), summary: text(p.Summary),
    order: p.Order?.number ?? 99, nav: p['Show in menu']?.checkbox ?? true,
  }) + (await localizeImages(body)));
  console.log('Synced', lang + '/' + slug);
}
console.log(`Done: ${rows.length} page(s).`);
