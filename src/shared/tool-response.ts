import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DomainError } from "../domain/errors.js";

export function toolJsonResult(value: unknown): CallToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
	};
}

export function toolError(err: unknown): CallToolResult {
	const message =
		err instanceof DomainError
			? `${err.code}: ${err.message}`
			: err instanceof Error
				? err.message
				: String(err);
	return {
		content: [{ type: "text", text: message }],
		isError: true,
	};
}
