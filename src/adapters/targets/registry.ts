import type { InstallTarget } from "../../ports/install-target.port.js";
import { ClaudeCodeTarget } from "./claude-code.target.js";

export interface TargetRegistry {
	readonly all: InstallTarget[];
	get(id: string): InstallTarget | undefined;
	resolveIds(spec: string): InstallTarget[];
}

export function buildTargetRegistry(): TargetRegistry {
	const all: InstallTarget[] = [new ClaudeCodeTarget()];
	const byId = new Map(all.map((t) => [t.id, t]));
	return {
		all,
		get(id: string) {
			return byId.get(id);
		},
		resolveIds(spec: string): InstallTarget[] {
			const parts = spec
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			if (parts.length === 0 || parts.includes("all")) {
				return all;
			}
			const out: InstallTarget[] = [];
			for (const id of parts) {
				const target = byId.get(id);
				if (!target) {
					const known = all.map((t) => t.id).join(", ");
					throw new Error(`Unknown target "${id}". Known targets: ${known}.`);
				}
				out.push(target);
			}
			return out;
		},
	};
}
