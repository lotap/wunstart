import {DurableObject} from 'cloudflare:workers'

// Wasm loading, memory management, and output/error buffer patterns adapted from
// cloudflare-auth-hasher-template. Allocates via Rust's `alloc`/`dealloc` exports,
// reads results via `output_ptr`/`output_len`, reads errors via `error_ptr`/`error_len`,
// and cleans up with `clear_buffers`. Status convention: 1 = success, 2 = error.
import kernelModule from './argon2-do-hasher.wasm'

export interface HashingOptions {
	readonly m: number
	readonly t: number
	readonly p: number
	readonly dkLen: number
}

interface RustKernelExports {
	// The module may export more than we declare; the index signature keeps the
	// interface assignable to `WebAssembly.Exports` so no assertion chain is needed.
	readonly [key: string]: WebAssembly.ExportValue
	memory: WebAssembly.Memory
	alloc(length: number): number
	dealloc(pointer: number, length: number): void
	hash_password(
		passwordPointer: number,
		passwordLength: number,
		saltPointer: number,
		saltLength: number,
		m: number,
		t: number,
		p: number,
		dkLen: number,
	): number
	verify_password(
		hashPointer: number,
		hashLength: number,
		passwordPointer: number,
		passwordLength: number,
	): number
	output_ptr(): number
	output_len(): number
	error_ptr(): number
	error_len(): number
	clear_buffers(): void
}

const SALT_LENGTH = 16

/** A buffer written into kernel memory: its offset and byte length. */
type KernelBuffer = {pointer: number; length: number}

export class AuthHasher extends DurableObject {
	private exports: RustKernelExports | null = null
	private encoder = new TextEncoder()
	private decoder = new TextDecoder()

	private async getKernel(): Promise<RustKernelExports> {
		if (this.exports) return this.exports
		const instance = await WebAssembly.instantiate(kernelModule, {})
		// SAFETY: `WebAssembly.Instance['exports']` is only typed as a loose record,
		// but this module is compiled from our curated Rust kernel whose exports are
		// exactly the RustKernelExports interface.
		this.exports = instance.exports as RustKernelExports
		return this.exports
	}

	private writeString(exports: RustKernelExports, value: string): KernelBuffer {
		const bytes = this.encoder.encode(value)
		return this.writeBytes(exports, bytes)
	}

	private writeBytes(exports: RustKernelExports, bytes: Uint8Array): KernelBuffer {
		const pointer = exports.alloc(bytes.length)
		if (bytes.length > 0) {
			new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes)
		}
		return {pointer, length: bytes.length}
	}

	private readString(exports: RustKernelExports, pointer: number, length: number): string {
		return this.decoder.decode(
			Uint8Array.from(new Uint8Array(exports.memory.buffer, pointer, length)),
		)
	}

	private readError(exports: RustKernelExports): Error {
		const message =
			this.readString(exports, exports.error_ptr(), exports.error_len()) ||
			'Rust Wasm kernel failed.'
		return new Error(message)
	}

	async hashPassword(password: string, options: HashingOptions): Promise<string> {
		const exports = await this.getKernel()
		const passwordBuffer = this.writeString(exports, password)
		const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
		const saltBuffer = this.writeBytes(exports, salt)

		try {
			const status = exports.hash_password(
				passwordBuffer.pointer,
				passwordBuffer.length,
				saltBuffer.pointer,
				saltBuffer.length,
				options.m,
				options.t,
				options.p,
				options.dkLen,
			)
			if (status !== 1) throw this.readError(exports)

			return this.readString(exports, exports.output_ptr(), exports.output_len())
		} finally {
			exports.dealloc(passwordBuffer.pointer, passwordBuffer.length)
			exports.dealloc(saltBuffer.pointer, saltBuffer.length)
			exports.clear_buffers()
		}
	}

	async verifyPassword(hash: string, password: string): Promise<boolean> {
		const exports = await this.getKernel()
		const hashBuffer = this.writeString(exports, hash)
		const passwordBuffer = this.writeString(exports, password)

		try {
			const status = exports.verify_password(
				hashBuffer.pointer,
				hashBuffer.length,
				passwordBuffer.pointer,
				passwordBuffer.length,
			)

			if (status === 2) throw this.readError(exports)

			return status === 1
		} finally {
			exports.dealloc(hashBuffer.pointer, hashBuffer.length)
			exports.dealloc(passwordBuffer.pointer, passwordBuffer.length)
			exports.clear_buffers()
		}
	}
}
