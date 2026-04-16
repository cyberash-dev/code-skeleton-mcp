import { z } from "zod";

export const getImportsInputSchema = z.object({
	path: z.string().min(1).describe("File to inspect for imports."),
});

export type GetImportsInput = z.infer<typeof getImportsInputSchema>;
