export interface CacheKey {
	path: string;
	mtimeMs: number;
	size: number;
}

export interface CachePort<T> {
	get(key: CacheKey): T | undefined;
	set(key: CacheKey, value: T): void;
	clear(): void;
}
