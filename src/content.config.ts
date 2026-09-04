import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const skills = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/skills' }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    order: z.number().default(0),
    dependsOn: z.array(z.string()).default([]),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional(),
    starterCode: z
      .object({
        go: z.string(),
        java: z.string(),
        typescript: z.string(),
        python: z.string(),
      })
      .partial()
      .default({}),
    simulation: z.enum(['code', 'git', 'design']).default('code'),
    designPreset: z.string().optional(),
    gitPreset: z.string().optional(),
  }),
});

export const collections = { skills };
