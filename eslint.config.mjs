import base from "@cyberash-dev/dev-tooling/eslint.base.mjs";

export default [
	...base,
	{ ignores: ["dist/", "wasm/", "queries/", "tests/fixtures/", "coverage/"] },
	{
		files: ["tests/**/*.ts"],
		rules: {
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-non-null-asserted-optional-chain": "off",
			"max-lines-per-function": "off",
		},
	},
];
