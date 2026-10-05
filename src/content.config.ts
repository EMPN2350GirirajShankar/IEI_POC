import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Same site, two content sources: Decap writes src/content/pages, the Notion sync writes src/content-notion/pages.
const base = process.env.CONTENT_SOURCE === 'notion' ? './src/content-notion/pages' : './src/content/pages';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base }),
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    order: z.number().default(99),
    nav: z.boolean().default(true),
  }),
});
export const collections = { pages };
