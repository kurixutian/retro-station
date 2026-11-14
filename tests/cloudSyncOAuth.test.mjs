import test from 'node:test';
import assert from 'node:assert/strict';

const REDIRECT_URI = 'com.retrostation.app:/oauth2redirect';

function parseOAuthRedirectUrl(url, redirectUri = REDIRECT_URI) {
  if (!url || !url.startsWith(redirectUri)) return null;
  const parsed = new URL(url);
  const oauthError = parsed.searchParams.get('error');
  if (oauthError) {
    const desc = parsed.searchParams.get('error_description') || oauthError;
    return { error: `Google sign-in failed: ${desc}` };
  }
  const code = parsed.searchParams.get('code');
  if (!code) return { error: 'OAuth canceled or no code returned' };
  return { code };
}

test('parseOAuthRedirectUrl extracts authorization code from single-slash redirect', () => {
  const res = parseOAuthRedirectUrl('com.retrostation.app:/oauth2redirect?code=abc123&scope=openid');
  assert.deepEqual(res, { code: 'abc123' });
});

test('parseOAuthRedirectUrl returns error when OAuth error is present', () => {
  const res = parseOAuthRedirectUrl('com.retrostation.app:/oauth2redirect?error=access_denied');
  assert.deepEqual(res, { error: 'Google sign-in failed: access_denied' });
});

test('parseOAuthRedirectUrl ignores unrelated deep links', () => {
  assert.equal(parseOAuthRedirectUrl('https://example.com/callback?code=abc'), null);
});
