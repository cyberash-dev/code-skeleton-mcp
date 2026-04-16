import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolError, toolJsonResult } from "../../shared/tool-response.js";
import { type GetClassInput, getClassInputSchema } from "./get-class.schema.js";
import type { GetClassUseCase } from "./get-class.usecase.js";

export function makeGetClassHandler(useCase: GetClassUseCase) {
	return {
		name: "get_class",
		config: {
			title: "Get class with methods",
			description:
				"Returns one class / interface / Go struct with method signatures (and, optionally, bodies). Prefer over `Read` when you want the public API surface of a single type without the rest of the file. Default `include_bodies: false` — signatures only; flip to `true` only if you need implementations. Supported languages: python, go, typescript, tsx, javascript.",
			inputSchema: getClassInputSchema.shape,
		},
		handler: async (args: GetClassInput): Promise<CallToolResult> => {
			try {
				return toolJsonResult(await useCase.execute(args));
			} catch (err) {
				return toolError(err);
			}
		},
	};
}
