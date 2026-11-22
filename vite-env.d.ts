/// <reference types="vite/client" />

declare module '*.wasm' {
	const module: WebAssembly.Module
	export default module
}

// The marker must be the last query parameter; TS supports one wildcard only.
// These declarations match any path, so they do not verify that the file
// exists: a moved or mistyped image fails in Vite, not in tsc.
declare module '*?responsive' {
	const image: import('#/lib/static-images.ts').StaticImageData
	export default image
}

declare module '*&responsive' {
	const image: import('#/lib/static-images.ts').StaticImageData
	export default image
}

interface ViteTypeOptions {
	// By adding this line, you can make the type of ImportMetaEnv strict
	// to disallow unknown keys.
	strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
	readonly VITE_COOKIE_DOMAIN?: string
	readonly VITE_COOKIE_SUFFIX?: string
	readonly MAILPIT_URL?: string
	// more env variables...
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
