import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolError, toolJsonResult } from "../../shared/tool-response.js";
import { type GetImportsInput, getImportsInputSchema } from "./get-imports.schema.js";
import type { GetImportsUseCase } from "./get-imports.usecase.js";

export function makeGetImportsHandler(useCase: GetImportsUseCase) {
	return {
		name: "get_imports",
		config: {
			title: "Get imports",
			description:
				"Lists all imports of a file with `isStdlib` / `isThirdParty` / `isRelative` flags and best-effort path resolution for relative imports. Prefer over `Read` + `Grep 'import'` when you need to understand a file's dependencies. Supported languages: python, go, typescript, tsx, javascript.",
			inputSchema: getImportsInputSchema.shape,
		},
		handler: async (args: GetImportsInput): Promise<CallToolResult> => {
			try {
				return toolJsonResult(await useCase.execute(args));
			} catch (err) {
				return toolError(err);
			}
		},
	};
}
