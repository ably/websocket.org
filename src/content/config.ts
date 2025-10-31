import { defineCollection, z } from 'astro:content';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    schema: docsSchema({
      extend: z.object({
        author: z.string().optional(),
        authorRole: z.string().optional(),
        date: z.coerce.date().optional(),
        category: z
          .enum([
            'guide',
            'reference',
            'tutorial',
            'news',
            'author',
            'resource',
            'tool',
            'infrastructure',
          ])
          .optional(),
        tags: z.array(z.string()).optional(),
        seo: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            keywords: z.array(z.string()).optional(),
            canonical: z.string().optional(),
            ogImage: z.string().optional(),
          })
          .optional(),
      }),
    }),
  }),
  i18n: defineCollection({ type: 'data', schema: i18nSchema() }),
};
