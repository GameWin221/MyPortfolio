import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',

	schema: z.object({
		title: z.string(),
		description: z.string(),
		published: z.coerce.date(),
		cover: z.string().optional(),
	}),
});

export const collections = { blog };
