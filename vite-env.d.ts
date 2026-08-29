/// <reference types="vite/client" />

declare module '*.wasm' {
	const module: WebAssembly.Module
	export default module
}

interface ViteTypeOptions {
	// By adding this line, you can make the type of ImportMetaEnv strict
	// to disallow unknown keys.
	strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
	readonly VITE_COOKIE_DOMAIN: string
	// more env variables...
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
