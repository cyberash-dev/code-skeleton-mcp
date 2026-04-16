import { z } from "zod";

export const getFunctionInputSchema = z.object({
	path: z.string().min(1).describe("File containing the target function or method."),
	symbol: z
		.string()
		.min(1)
		.describe(
			'Symbol path: "func_name" or "ClassName.method_name" or "outer.inner.fn". For Python @overload, all variants are returned.',
		),
});

export type GetFunctionInput = z.infer<typeof getFunctionInputSchema>;
