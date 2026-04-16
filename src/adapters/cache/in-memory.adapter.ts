import type { CacheKey, CachePort } from "../../ports/cache.port.js";

function keyToString(k: CacheKey): string {
	return `${k.path}::${k.mtimeMs}::${k.size}`;
}

export class InMemoryCacheAdapter<T> implements CachePort<T> {
	private readonly store = new Map<string, T>();

	get(key: CacheKey): T | undefined {
		return this.store.get(keyToString(key));
	}

	set(key: CacheKey, value: T): void {
		this.store.set(keyToString(key), value);
	}

	clear(): void {
		this.store.clear();
	}
}
