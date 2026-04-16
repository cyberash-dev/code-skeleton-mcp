import { z } from "zod";

export const getClassInputSchema = z.object({
	path: z.string().min(1).describe("File containing the target class, interface, or struct."),
	symbol: z
		.string()
		.min(1)
		.describe('Class/interface/struct name (supports nested paths like "Outer.Inner").'),
	include_bodies: z
		.boolean()
		.default(false)
		.describe("Include full method bodies. Default: false — signatures only."),
});

export type GetClassInput = z.infer<typeof getClassInputSchema>;
