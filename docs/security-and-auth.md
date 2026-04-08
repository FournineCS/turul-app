# Security & Authentication

## Authentication System

The app includes optional local authentication for protecting stored credentials.

### Components

| File | Purpose |
|------|---------|
| `src/main/auth/auth-service.ts` | Password management, session handling |
| `src/main/auth/crypto-service.ts` | AES-256-GCM encryption/decryption |
| `src/main/auth/app-profile-manager.ts` | Encrypted profile storage |

### Password Hashing

Passwords are hashed using Node.js `scrypt`:

```
Algorithm: scrypt
Parameters: N=16384, R=8, P=1
Salt: 32 random bytes
Output: 64 bytes (hex-encoded)
```

### Encryption Key Derivation

An AES-256 encryption key is derived from the password:

```
scrypt(password, salt, keyLength=32) → encryption key
```

This key encrypts/decrypts stored AWS credentials.

### Credential Encryption

Stored profiles use AES-256-GCM:

```
encrypt(plaintext, key) → { iv, authTag, ciphertext }
decrypt({ iv, authTag, ciphertext }, key) → plaintext
```

Each profile's sensitive fields (access keys, session tokens) are encrypted as a single JSON blob.

### Session Management

- **Timeout**: 15 minutes of inactivity triggers auto-logout
- **State**: Session tracked in memory (not persisted)
- **Logout**: Clears encryption key from memory

### Rate Limiting

Failed login attempts trigger progressive lockout:

| Attempts | Lockout Duration |
|----------|-----------------|
| 1-4 | None |
| 5 | 30 seconds |
| 6 | 60 seconds |
| 7 | 120 seconds |
| 8 | 300 seconds |
| 9+ | 600 seconds |

### Password Change

When a user changes their password:

1. Verify current password
2. Derive new encryption key from new password
3. Decrypt all stored profiles with old key
4. Re-encrypt all profiles with new key
5. Update password hash
6. All operations in a single transaction (atomic)

## CORS Policy (Server Mode)

The Express server restricts CORS to localhost only:

```typescript
origin: /^https?:\/\/localhost(:\d+)?$/
```

This prevents remote access to the API when running in server mode.

## Content Security Policy (Electron)

The Electron main process sets CSP headers:

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
```

## Credential Handling Best Practices

1. **AWS credentials from `~/.aws/`** are read-only and never stored by the app
2. **App-managed profiles** are encrypted at rest in SQLite
3. **Encryption keys** exist only in memory during active sessions
4. **No credentials** are logged or exposed via IPC/HTTP responses
5. **SSO profiles** only store non-secret metadata (start URL, account ID, role name)

## Profile Types

| Type | Stored Data | Encryption |
|------|-------------|------------|
| `credentials` / `config` | Reference to `~/.aws/` profiles | Not stored (read from AWS config) |
| `iam_keys` | Access key ID, secret key, session token | AES-256-GCM encrypted |
| `sso_config` | SSO URL, region, account ID, role name | Metadata stored plain, no secrets |
| `assume_role` | Role ARN, external ID, source profile | Metadata stored plain |
