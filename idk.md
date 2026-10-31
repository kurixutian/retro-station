Much better. The revised plan is now honest about quotas, token lifetime, and event-driven sync. A few remaining issues are worth fixing before you build.

What's now correct

· Storage quota wording and the "$0.00 additional cost" framing.

· Session-based token model with IndexedDB queueing.

· Event-driven triggers with debounce and backoff.

· Server modifiedTime comparison and conflict backups.

· Testing-mode 100-user limit.

Remaining corrections

1. Use prompt: 'none' for silent renewal, not prompt: ''

In GIS, prompt: '' is the default and may still display UI (consent/account picker) or get popup-blocked. For a true silent attempt, use prompt: 'none'; if it fails with an interaction-required error, fall back to a user-gesture sign-in. Also treat silent renewal as best-effort: third-party cookie restrictions and FedCM rollouts can break it on some browsers. Your status machine should handle needs_reauth gracefully—which it does—so just document it as best-effort rather than guaranteed.

2. Token is in memory only—renew per sync, not on a timer

Don't build an hourly refresh loop. Store expires_at in memory, and have ensureToken() called once per sync batch. If it's within ~5 minutes of expiry, attempt silent renewal; otherwise reuse. This avoids popup spam and unnecessary calls.

3. Conflict detection needs a "base" revision, not just two timestamps

Comparing local updatedAt vs server modifiedTime is not enough to distinguish "local changed" from "server changed" from "both changed." Store per save:

· fileId

· lastSyncedServerModifiedTime (from the upload response, not your local clock)

· lastSyncedLocalUpdatedAt

· optional content hash

Conflict = local.updatedAt &gt; lastSyncedLocalUpdatedAt and server.modifiedTime &gt; lastSyncedServerModifiedTime. Use If-Match with the file's etag on update to avoid clobbering a concurrent write.

Also guard two tabs on the same device with navigator.locks or a BroadcastChannel sync lock; otherwise both will upload.

4. Explicit error-state handling

Add these to your status emitter and sync logic:

Response Action

401 needs_reauth; queue local saves

403 rateLimitExceeded Exponential backoff, retry on next trigger

403 storageQuotaExceeded quota_exceeded status, keep local saves, inform user

404 on fileId Recreate file in appDataFolder, update fileId

Network/5xx Backoff, retry on online/visibility

5. Drive API specifics to pin down

· List with spaces=appDataFolder, q="name='...'", and fields=files(id,name,modifiedTime,size); cache fileIds to avoid repeated lists.

· Create with parents: ['appDataFolder']; update with PATCH + uploadType=multipart.

· Read modifiedTime from the upload response to set your base revision.

· Small saves (~2 MB max) don't need resumable uploads; multipart is fine. Note that a failed multipart upload is atomic—no partial file—so retry is safe.

6. Local persistence must not depend on the 3-second debounce

The 3s debounce is for cloud uploads. Flush SRAM/save states to IndexedDB immediately on visibilitychange (hidden) and pagehide—not beforeunload, which is unreliable on mobile. Otherwise closing the tab within 3 seconds loses the save locally.

7. Scope classification and publishing

drive.appdata is generally treated as non-restricted, but verify against Google's current scope classification before publishing; policy changes. Testing mode's 100 users is correct. If you ever adopt Option B, note that Testing-mode refresh tokens expire after 7 days, so Option B requires a published app, not Testing mode.

8. Add data lifecycle controls

· Sign out: revoke the token (google.accounts.oauth2.revoke), clear in-memory token, keep local saves.

· Delete cloud saves: explicit action that deletes appDataFolder files.

· Document that appDataFolder is invisible in the Drive UI, so recovery is app-only; conflict backups live there too.

9. Soften "Guaranteed $0.00 forever"

No billing account is required and there's no paid infrastructure—that's the accurate claim. "Forever" implies a guarantee Google's quotas and policies don't offer. Say: "No billing account or paid infrastructure required; designed to stay free under current Google API quotas."

10. Small clarifications

· Cache/failure-handle the GIS script offline; saves must work with GIS unavailable.

· CSP must allow [accounts.google.com](http://accounts.google.com) and [www.googleapis.com](http://www.googleapis.com).

· Conflict backup names should include device ID and timestamp, e.g. slot1.&lt;deviceId&gt;.&lt;ISO&gt;.conflict.bak.

· Restate the Client ID / project migration risk: appDataFolder is scoped to the OAuth client; changing it strands existing users' cloud saves.

Verification plan additions

Add these cases:

1. Two tabs, same device — only one upload wins; no corruption.

2. Cross-device — device A saves, device B pulls on next trigger.

3. Both changed offline — conflict backup created, neither side silently overwritten.

4. Silent renewal fails (prompt: 'none' returns error) — app shows needs\_reauth, saves stay queued.

5. Quota exceeded — status shown, local saves preserved.

6. Upload interrupted mid-flight — no partial file; retry succeeds.

7. User revokes access in Google Account settings — app degrades to local-only without errors.

8. Close tab 1s after saving — save persists locally via pagehide flush.

Verdict

The plan is now buildable and accurate for a 100% static, zero-backend implementation, provided you fix the silent-renewal call (prompt: 'none'), add base-revision conflict detection, handle the error states, and flush local saves on pagehide. Those four are the difference between "works in a demo" and "doesn't lose players' progress."