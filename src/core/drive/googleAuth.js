import { Capacitor } from '@capacitor/core';

/**
 * googleAuth.js
 * --------------
 * One place to obtain a Google Drive (appDataFolder) access token on both
 * Android (native Google Sign-In plugin) and web (Google Identity
 * Services popup). Tokens are cached for ~50 minutes.
 *
 * `interactive: false` never shows UI — used by automatic backups. On
 * Android it silently refreshes the token for the account that signed in
 * earlier. On web, silent refresh isn't possible without a popup, so it
 * only returns a still-valid cached token.
 */

export const GOOGLE_CLIENT_ID = '813773523036-4vo5qijl8uvtdqsd83qb5c7c7j9hth0u.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expiry';
const CONNECTED_KEY = 'gdrive_connected';
const TOKEN_TTL_MS = 50 * 60 * 1000;

let nativeInit = null;
async function getNativeAuth() {
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
  if (!nativeInit) {
    nativeInit = GoogleAuth.initialize({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email', SCOPE],
      grantOfflineAccess: true,
    }).catch(() => {});
  }
  await nativeInit;
  return GoogleAuth;
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function cacheToken(token) {
  safeSet(TOKEN_KEY, token);
  safeSet(EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
  safeSet(CONNECTED_KEY, '1');
}

export function getCachedToken() {
  const token = safeGet(TOKEN_KEY);
  const expiry = Number(safeGet(EXPIRY_KEY));
  if (token && expiry && Date.now() < expiry) return token;
  return null;
}

/** True once the user has connected Drive on this device at least once. */
export function isDriveConnected() {
  return safeGet(CONNECTED_KEY) === '1';
}

export function clearDriveToken() {
  safeRemove(TOKEN_KEY);
  safeRemove(EXPIRY_KEY);
}

export async function disconnectDrive() {
  clearDriveToken();
  safeRemove(CONNECTED_KEY);
  if (Capacitor.isNativePlatform()) {
    try {
      const GoogleAuth = await getNativeAuth();
      await GoogleAuth.signOut();
    } catch {
      /* ignore */
    }
  }
}

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

async function webInteractiveToken() {
  await loadGsiScript();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) reject(new Error(response.error));
          else resolve(response.access_token);
        },
        error_callback: (err) => reject(new Error(err?.message || 'Google sign-in was closed.')),
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns a Drive access token, or null when `interactive` is false and
 * no token can be obtained silently.
 */
export async function getDriveToken({ interactive = false } = {}) {
  const cached = getCachedToken();
  if (cached) return cached;

  if (Capacitor.isNativePlatform()) {
    const GoogleAuth = await getNativeAuth();
    // 1. Silent refresh for a previously signed-in account.
    try {
      const auth = await GoogleAuth.refresh();
      // refresh() resolves with the Authentication object itself.
      const token = auth?.accessToken || auth?.authentication?.accessToken;
      if (token) {
        cacheToken(token);
        return token;
      }
    } catch {
      /* not signed in yet */
    }
    if (!interactive) return null;
    // 2. Full sign-in UI.
    const user = await GoogleAuth.signIn();
    const token = user?.authentication?.accessToken || user?.accessToken;
    if (!token) throw new Error('Google sign-in failed (no access token).');
    cacheToken(token);
    return token;
  }

  if (!interactive) return null;
  const token = await webInteractiveToken();
  if (!token) throw new Error('Google sign-in failed (no access token).');
  cacheToken(token);
  return token;
}
