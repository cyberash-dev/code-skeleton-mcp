import { z } from "zod";

export const getOutlineInputSchema = z.object({
	path: z.string().min(1).describe("Absolute or relative path to a file or directory."),
	max_depth: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(2)
		.describe("Nesting depth for classes and functions. Default: 2."),
	include_docstrings: z
		.boolean()
		.default(true)
		.describe("Include the first line of docstrings / JSDoc / Go comments."),
	include_private: z
		.boolean()
		.default(false)
		.describe(
			"Include private symbols (_leading underscore, `private` modifier, lowercase Go names).",
		),
	recursive: z
		.boolean()
		.default(false)
		.describe("If `path` is a directory, walk subdirectories."),
});

export type GetOutlineInput = z.infer<typeof getOutlineInputSchema>;
