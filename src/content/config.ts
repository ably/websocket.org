import { defineCollection, z } from 'astro:content';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// Extend the docs schema with our custom fields
const extendedDocsSchema = docsSchema({
  extend: z.object({
    author: z.string().optional(),
    authorRole: z.string().optional(),
    date: z.coerce.date().optional(),
    category: z.enum(['guide', 'reference', 'tutorial', 'news']).optional(),
    tags: z.array(z.string()).optional(),
    seo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      canonical: z.string().optional(),
      ogImage: z.string().optional(),
    }).optional(),
  }),
});

export const collections = {
  docs: defineCollection({ schema: extendedDocsSchema }),
  i18n: defineCollection({ type: 'data', schema: i18nSchema() }),
};
