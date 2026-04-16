import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolError, toolJsonResult } from "../../shared/tool-response.js";
import { type GetOutlineInput, getOutlineInputSchema } from "./get-outline.schema.js";
import type { GetOutlineUseCase } from "./get-outline.usecase.js";

export function makeGetOutlineHandler(useCase: GetOutlineUseCase) {
	return {
		name: "get_outline",
		config: {
			title: "Get outline",
			description:
				"Returns a compact structural skeleton (classes, functions, method signatures, first-line docstrings) of a source file or directory. Prefer over `Read` for files >200 lines when the goal is to understand *what's in* the file rather than edit it — typically 20-40x fewer tokens. Supported languages: python, go, typescript, tsx, javascript. Pass a directory for a multi-file outline; `recursive: true` walks subdirectories.",
			inputSchema: getOutlineInputSchema.shape,
		},
		handler: async (args: GetOutlineInput): Promise<CallToolResult> => {
			try {
				const result = await useCase.execute(args);
				return toolJsonResult(result);
			} catch (err) {
				return toolError(err);
			}
		},
	};
}
