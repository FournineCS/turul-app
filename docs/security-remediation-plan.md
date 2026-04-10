# Security Remediation Plan — turul-app

**Created:** 2026-04-10
**Last Verified:** 2026-04-10
**Status:** All items still pending implementation
**Review scope:** Auth/crypto, IPC/preload, secrets/credentials, AI chat/tool calling

---

## Status Summary

| Phase | Items | Risk | Status |
|-------|-------|------|--------|
| Phase 1 | 6 trivial fixes | NONE | All still present |
| Phase 2 | 7 validation fixes | LOW | All still present |
| Phase 3 | 7 behavioral changes | LOW-MEDIUM | All still present |
| Phase 4 | 2 architectural | HIGH | Deferred |

**Breaking risk for current app:** Phase 1 and 2 are safe. Phase 3 items M-4/L-4 (scrypt) and H-5 (credential refactor) need careful testing. Phase 4 is deferred.

---

## Phase 1 — Zero-Risk / Trivial (< 30 min total)

### C-1: npm audit fix (axios SSRF in devDependency wait-on)
- **Status:** STILL PRESENT — `wait-on` in devDependencies (package.json line 240)
- **Files:** `package.json`
- **Change:** `npm audit fix` or remove `wait-on` (already bypassed by `dev:simple`)
- **Breaking risk:** NONE

### L-1: aws:validate-profile missing auth guard
- **Status:** STILL PRESENT — no `requireAuth()` in handler
- **Files:** `src/main/ipc/aws-handlers.ts` (~line 122)
- **Change:** Add `requireAuth()` at top of handler
- **Breaking risk:** NONE — page is post-login

### L-2: settings:clear-gcloud-cache missing auth guard
- **Status:** STILL PRESENT — no `requireAuth()` in handler
- **Files:** `src/main/ipc/app-handlers.ts` (~line 158)
- **Change:** Add `requireAuth()` + try/catch wrapper
- **Breaking risk:** NONE — settings page is post-login

### L-3: Biometric disable cleanup
- **Status:** STILL PRESENT — sets `biometric_key_blob` to `''` instead of deleting
- **Files:** `src/main/auth/biometric-service.ts` (line 64)
- **Change:** Use `deleteSetting('biometric_key_blob')` or set to `null`
- **Breaking risk:** NONE

### M-2: Password min-length alignment
- **Status:** STILL PRESENT — `assertString` minLen is `6` in both handlers, but service layer requires 12
- **Files:** `src/main/ipc/auth-handlers.ts` (lines 42-43, 92-93)
- **Change:** Change minLen from `6` to `12` for `auth:setup` and `auth:change-password`. Keep `auth:login` at `1`.
- **Breaking risk:** NONE — service layer already rejects < 12

### L-6: Log JSON.parse failure in bedrock provider
- **Status:** STILL PRESENT — empty `catch {}` block with no logging
- **Files:** `src/main/ai/providers/bedrock-provider.ts` (line 117-119)
- **Change:** Add `console.warn` in the catch block
- **Breaking risk:** NONE

---

## Phase 2 — Input Validation Hardening (~4-5 hrs)

### L-5: searchResources LIKE wildcard escape
- **Status:** STILL PRESENT — raw user input in `%${query}%` without escaping `%` and `_`
- **Files:** `src/main/database/db-manager.ts` (~line 724)
- **Change:** Escape `%` and `_` in search query, add `ESCAPE '\\'` to SQL
- **Breaking risk:** NONE
- **Can break app?** No — only affects edge case where user types literal `%` or `_`

### M-1: assertSafePath — null-byte + base-dir confinement
- **Status:** STILL PRESENT — no null-byte (`\0`) rejection
- **Files:** `src/main/ipc/validation.ts` (lines 121-128)
- **Change:** Add null-byte rejection, add optional `baseDir` confinement parameter
- **Breaking risk:** NONE (additive)

### M-5: Chat handlers missing validation
- **Status:** STILL PRESENT — 5 handlers use typed params without assertString
- **Files:** `src/main/ipc/chat-handlers.ts`
- **Handlers:** `chat:stop-generation` (line 54), `chat:get-conversation` (83), `chat:create-conversation` (116), `chat:delete-conversation` (137), `chat:update-title` (147)
- **Change:** Change params from `string` to `unknown`, add `assertString` with length bounds. Validate `provider` with `assertOneOf(['bedrock', 'anthropic', 'openai', 'gemini', 'claude-code'])` in `chat:create-conversation`.
- **Breaking risk:** NONE
- **Note:** Provider list updated to include all 5 providers (was just `['bedrock']`)

### M-8: Context/providerConfig interior field validation
- **Status:** STILL PRESENT — no `assertChatContext` or `assertProviderConfig` in validation.ts
- **Files:** `src/main/ipc/validation.ts`, `src/main/ipc/chat-handlers.ts`
- **Change:** Add `assertChatContext` and `assertProviderConfig` validators. Replace `assertObject` calls.
- **Breaking risk:** LOW — verify renderer always sends `cloudProvider`
- **Can break app?** Potentially if renderer sends unexpected field values — test chat after implementing

### H-3: GCP handler validation (largest fix)
- **Status:** STILL PRESENT — handlers use typed params without validation
- **Files:** `src/main/ipc/gcp-handlers.ts`
- **Change:** Change all ~50+ handler params from typed to `unknown`, add `assertString`/`assertObject`/`assertDateString`
- **Breaking risk:** LOW — test each GCP page after change
- **Can break app?** Yes if any GCP page sends params in unexpected format — needs full GCP page testing
- **Depends on:** M-8

### H-4: AI tool input schema validation
- **Status:** STILL PRESENT — no `validateToolInput` function in tool-registry.ts
- **Files:** `src/main/ai/tools/tool-registry.ts`
- **Change:** Add `validateToolInput(schema, args)` before execution
- **Breaking risk:** LOW
- **Can break app?** Potentially if AI sends arguments that don't match schema exactly — be lenient on coercion

---

## Phase 3 — Behavioral / Security Logic Changes (~4-5 hrs)

### H-2: Windows gcloud spawn `shell: true`
- **Status:** STILL PRESENT — uses `shell: true` on Windows without metacharacter rejection
- **Files:** `src/main/gcp/auth-manager.ts` (lines 54-57)
- **Change:** Harden `assertSafeGcloudPath` to reject Windows metacharacters
- **Breaking risk:** LOW
- **Can break app?** Only on Windows if gcloud path contains special chars — unlikely

### M-3: Persist auth lockout across restarts
- **Status:** STILL PRESENT — `failedAttempts` and `lockoutUntil` are in-memory only
- **Files:** `src/main/auth/auth-service.ts` (lines 31-32)
- **Change:** Save to settings table on each failure, load on construction, clear on successful login
- **Breaking risk:** LOW
- **Can break app?** No — additive change, only affects brute-force lockout behavior

### M-4: changePassword legacy scrypt support
- **Status:** STILL PRESENT — no legacy scrypt fallback in changePassword
- **Files:** `src/main/auth/auth-service.ts` (line 239)
- **Change:** Mirror `login()`'s fallback loop in `_changePasswordInternal`
- **Breaking risk:** LOW
- **Can break app?** No — adds fallback path only. But test password change with existing users.
- **Do before:** L-4

### L-4: scrypt N upgrade (16384 to 32768)
- **Status:** STILL PRESENT — `SCRYPT_N = 16384`
- **Files:** `src/main/auth/auth-service.ts` (line 10)
- **Change:** Increase to 32768, add 16384 to legacy migration array
- **Breaking risk:** LOW — migration mechanism handles it
- **Can break app?** Could slow login on low-end devices. Test on Node 22+ first.
- **Depends on:** M-4

### M-7: System prompt enforcement (documentation only)
- **Status:** STILL PRESENT — no documentation added
- **Files:** `src/main/ai/system-prompt.ts`, `src/main/ai/tools/tool-registry.ts`
- **Change:** Add code comments documenting closed whitelist. No runtime change.
- **Breaking risk:** NONE

### H-5: Bedrock credentials over IPC refactor
- **Status:** STILL PRESENT — renderer sends all credentials (apiKey, secretKey, etc.) over IPC in `providerConfig`
- **Files:** `src/renderer/stores/chatStore.ts`, `src/main/ipc/chat-handlers.ts`, `src/main/ai/ai-service.ts`, `src/main/preload.ts`
- **Change:** Main process loads credentials from encrypted settings instead of receiving over IPC. Renderer sends only provider type + non-secret config (model, region).
- **Breaking risk:** MEDIUM — touches 4 files
- **Can break app?** Yes if settings loading fails or keys not yet saved — needs fallback. This is the highest risk Phase 3 item.
- **Note:** Now applies to all 5 providers (Bedrock, Anthropic, OpenAI, Gemini, Claude Code), not just Bedrock
- **Depends on:** M-5

---

## Phase 4 — Architectural (Deferred to dedicated sprints)

### M-6: CSP `unsafe-inline` for styles
- **Status:** STILL PRESENT — production CSP uses `style-src 'self' 'unsafe-inline'`
- **Files:** `src/main/index.ts` (lines 92-103)
- **Change:** Audit all 81 components for inline styles, implement nonce-based approach
- **Breaking risk:** HIGH — likely breaks styling
- **Can break app?** YES — almost certainly breaks inline styles across multiple components

### H-1: SQLCipher database encryption at rest
- **Status:** STILL PRESENT — using `better-sqlite3` (unencrypted)
- **Files:** `package.json`, `src/main/database/db-manager.ts`
- **Change:** Replace with SQLCipher build, derive DB key from master password
- **Breaking risk:** HIGH — native dep change, migration complexity
- **Can break app?** YES — requires data migration, cross-platform build changes

---

## Dependency Graph

```
M-8 (validation utils)  -->  H-3 (GCP handlers use new utils)
M-5 (chat validation)   -->  H-5 (both touch chat-handlers.ts)
M-4 (legacy scrypt)     -->  L-4 (safe to bump N only after fallback works)
M-2 (password length)   -->  H-5 (both touch auth/chat area)
```

---

## Implementation Priority (Recommended Order)

### Safe to implement now (no app breakage risk):
1. C-1, L-1, L-2, L-3, L-6, M-7 — trivial, zero risk
2. M-2 — password minLen alignment (service already enforces)
3. L-5 — LIKE wildcard escape
4. M-1 — null-byte in assertSafePath
5. M-5 — chat handler validation (update provider list to all 5)

### Implement with testing:
6. M-3 — lockout persistence (additive)
7. M-8 → H-3 — validation utils → GCP handlers (test all GCP pages)
8. H-4 — tool input validation (lenient coercion)
9. M-4 → L-4 — scrypt fallback → N upgrade (test password change)
10. H-2 — Windows gcloud hardening (Windows-only testing)

### Implement with careful rollout:
11. H-5 — credential refactor (4 files, needs fallback)

### Defer:
12. M-6 — CSP unsafe-inline (needs full component audit)
13. H-1 — SQLCipher (dedicated sprint)

---

## Testing Checklist

- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] Login with existing password still works after L-4 N upgrade
- [ ] GCP scan start works after H-3 validation
- [ ] Chat send works with all 5 providers after H-5 credential refactor
- [ ] All GCP cost/security/IAM/network/compliance pages work after H-3
- [ ] Profile validation requires auth after L-1
- [ ] Settings clear-gcloud-cache requires auth after L-2
- [ ] `changePassword` works for users with legacy scrypt N=65536 hashes
- [ ] Password min 12 chars enforced consistently
- [ ] Auth lockout state survives app restarts
- [ ] `searchResources` escapes LIKE wildcards
- [ ] Windows gcloud spawn doesn't use `shell: true` or metacharacters are rejected
- [ ] No regressions across all pages
- [ ] AI Chat works with Bedrock, Anthropic, OpenAI, Gemini, Claude Code after H-5
