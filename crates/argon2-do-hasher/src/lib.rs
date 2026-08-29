// Wasm kernel adapted from cloudflare-auth-hasher-template.
// The template's alloc/dealloc, thread-local buffer pattern, output/error pointer
// exports, read_utf8/bytes helpers, and validation guards were used as reference.
// Key difference: this crate accepts Argon2 params + salt as function arguments
// at runtime rather than compile-time env vars or optional features.
use std::cell::RefCell;
use std::slice;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params as Argon2Params, Version};

use unicode_normalization::UnicodeNormalization;

const SALT_LEN: usize = 16;
const MAX_PASSWORD_LENGTH: usize = 1024;
const MAX_HASH_LENGTH: usize = 4096;

thread_local! {
	static LAST_OUTPUT: RefCell<Vec<u8>> = RefCell::new(Vec::new());
	static LAST_ERROR: RefCell<Vec<u8>> = RefCell::new(Vec::new());
}

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
	let mut buffer = Vec::<u8>::with_capacity(len);
	let ptr = buffer.as_mut_ptr();
	std::mem::forget(buffer);
	ptr
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, len: usize) {
	if ptr.is_null() || len == 0 {
		return;
	}
	unsafe {
		drop(Vec::from_raw_parts(ptr, len, len));
	}
}

#[no_mangle]
pub extern "C" fn hash_password(
	password_ptr: *const u8,
	password_len: usize,
	salt_ptr: *const u8,
	salt_len: usize,
	m: u32,
	t: u32,
	p: u32,
	dk_len: u32,
) -> u32 {
	match run_hash(password_ptr, password_len, salt_ptr, salt_len, m, t, p, dk_len) {
		Ok(hash) => {
			store_output(hash.into_bytes());
			clear_error();
			1
		}
		Err(error) => {
			store_error(error.into_bytes());
			2
		}
	}
}

fn run_hash(
	password_ptr: *const u8,
	password_len: usize,
	salt_ptr: *const u8,
	salt_len: usize,
	m: u32,
	t: u32,
	p: u32,
	dk_len: u32,
) -> Result<String, String> {
	let password = read_utf8(password_ptr, password_len)?;
	validate_password(&password)?;
	let salt_bytes = read_bytes(salt_ptr, salt_len)?;
	if salt_bytes.len() != SALT_LEN {
		return Err(format!("Argon2 salt must be {SALT_LEN} bytes."));
	}

	let normalized = password.nfkc().collect::<String>();
	let params = Argon2Params::new(m, t, p, Some(dk_len as usize))
		.map_err(|e| format!("Invalid Argon2id parameters: {e}"))?;
	let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
	let salt = SaltString::encode_b64(&salt_bytes)
		.map_err(|e| format!("Failed to encode Argon2 salt: {e}"))?;
	let hash = argon2
		.hash_password(normalized.as_bytes(), &salt)
		.map_err(|e| format!("Argon2id hashing failed: {e}"))?;

	Ok(hash.to_string())
}

#[no_mangle]
pub extern "C" fn verify_password(
	hash_ptr: *const u8,
	hash_len: usize,
	password_ptr: *const u8,
	password_len: usize,
) -> u32 {
	match run_verify(hash_ptr, hash_len, password_ptr, password_len) {
		Ok(true) => {
			clear_error();
			1
		}
		Ok(false) => {
			clear_error();
			0
		}
		Err(error) => {
			store_error(error.into_bytes());
			2
		}
	}
}

fn run_verify(
	hash_ptr: *const u8,
	hash_len: usize,
	password_ptr: *const u8,
	password_len: usize,
) -> Result<bool, String> {
	let hash = read_utf8(hash_ptr, hash_len)?;
	let password = read_utf8(password_ptr, password_len)?;
	validate_password(&password)?;
	validate_hash(&hash)?;

	if !hash.starts_with("$argon2") {
		return Err("Unsupported password hash format.".into());
	}

	let normalized = password.nfkc().collect::<String>();
	let parsed = PasswordHash::new(&hash)
		.map_err(|e| format!("Invalid Argon2id hash: {e}"))?;

	match Argon2::default().verify_password(normalized.as_bytes(), &parsed) {
		Ok(()) => Ok(true),
		Err(argon2::password_hash::Error::Password) => Ok(false),
		Err(e) => Err(format!("Argon2id verification failed: {e}")),
	}
}

#[no_mangle]
pub extern "C" fn output_ptr() -> *const u8 {
	LAST_OUTPUT.with(|buffer| buffer.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn output_len() -> usize {
	LAST_OUTPUT.with(|buffer| buffer.borrow().len())
}

#[no_mangle]
pub extern "C" fn error_ptr() -> *const u8 {
	LAST_ERROR.with(|buffer| buffer.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn error_len() -> usize {
	LAST_ERROR.with(|buffer| buffer.borrow().len())
}

#[no_mangle]
pub extern "C" fn clear_buffers() {
	LAST_OUTPUT.with(|buffer| buffer.borrow_mut().clear());
	LAST_ERROR.with(|buffer| buffer.borrow_mut().clear());
}

// Helper pattern adapted from cloudflare-auth-hasher-template
fn read_utf8(ptr: *const u8, len: usize) -> Result<String, String> {
	if ptr.is_null() && len != 0 {
		return Err("Kernel received a null pointer for non-empty input.".into());
	}
	let bytes = unsafe { slice::from_raw_parts(ptr, len) };
	String::from_utf8(bytes.to_vec()).map_err(|e| format!("Kernel received invalid UTF-8: {e}"))
}

fn read_bytes(ptr: *const u8, len: usize) -> Result<Vec<u8>, String> {
	if ptr.is_null() && len != 0 {
		return Err("Kernel received a null pointer for non-empty input.".into());
	}
	Ok(unsafe { slice::from_raw_parts(ptr, len).to_vec() })
}

// Validation guard adapted from cloudflare-auth-hasher-template
fn validate_password(password: &str) -> Result<(), String> {
	if password.is_empty() {
		return Err("Password must not be empty.".into());
	}
	if password.len() > MAX_PASSWORD_LENGTH {
		return Err(format!(
			"Password exceeds the maximum supported length of {MAX_PASSWORD_LENGTH} bytes.",
		));
	}
	Ok(())
}

fn validate_hash(hash: &str) -> Result<(), String> {
	if hash.is_empty() {
		return Err("Hash must not be empty.".into());
	}
	if hash.len() > MAX_HASH_LENGTH {
		return Err(format!("Hash exceeds the maximum supported length of {MAX_HASH_LENGTH} bytes."));
	}
	Ok(())
}

// Thread-local buffer pattern adapted from cloudflare-auth-hasher-template
fn store_output(bytes: Vec<u8>) {
	LAST_OUTPUT.with(|buffer| {
		let mut buffer = buffer.borrow_mut();
		buffer.clear();
		buffer.extend_from_slice(&bytes);
	});
}

fn store_error(bytes: Vec<u8>) {
	LAST_ERROR.with(|buffer| {
		let mut buffer = buffer.borrow_mut();
		buffer.clear();
		buffer.extend_from_slice(&bytes);
	});
}

fn clear_error() {
	LAST_ERROR.with(|buffer| buffer.borrow_mut().clear());
}
