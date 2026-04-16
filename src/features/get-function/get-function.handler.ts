import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolError, toolJsonResult } from "../../shared/tool-response.js";
import { type GetFunctionInput, getFunctionInputSchema } from "./get-function.schema.js";
import type { GetFunctionUseCase } from "./get-function.usecase.js";

export function makeGetFunctionHandler(useCase: GetFunctionUseCase) {
	return {
		name: "get_function",
		config: {
			title: "Get function body",
			description:
				"Returns the full source of one function or method identified by dotted symbol path (`func_name`, `ClassName.method`, `outer.inner.fn`). Prefer over `Read` with offset/limit when you need exactly one function body — no line-counting needed, no surrounding noise. Returns all `variants[]` for Python `@overload` sets. Supported languages: python, go, typescript, tsx, javascript.",
			inputSchema: getFunctionInputSchema.shape,
		},
		handler: async (args: GetFunctionInput): Promise<CallToolResult> => {
			try {
				return toolJsonResult(await useCase.execute(args));
			} catch (err) {
				return toolError(err);
			}
		},
	};
}
