import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace sheets scope
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Web Client ID from Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
const GOOGLE_WEB_CLIENT_ID = '431861011757-6tr0d52botic6c3uqebsq9iuks4pplck.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory and local storage.
const GOOGLE_ACCESS_TOKEN_KEY = 'mente-viva-google-token';
let cachedAccessToken: string | null = null;

// Google Identity Services token client, used to silently renew the
// Sheets access token in the background (no popup) once it expires,
// as long as the user's Google session in the browser is still valid.
let tokenClient: any = null;

function getTokenClient(): any {
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) {
    throw new Error('Google Identity Services ainda não carregou.');
  }
  if (!tokenClient) {
    tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: SHEETS_SCOPE,
      callback: () => {}, // overridden per-call below
    });
  }
  return tokenClient;
}

/**
 * Tries to get a fresh access token WITHOUT showing a popup, using the
 * user's existing Google session. Resolves to null if silent renewal
 * isn't possible (e.g. user revoked access, or no active Google session) —
 * in that case, the caller should fall back to googleSignIn() (popup).
 */
export const silentTokenRefresh = async (): Promise<string | null> => {
  try {
    const client = getTokenClient();
    return await new Promise<string | null>((resolve) => {
      client.callback = (response: any) => {
        if (response?.access_token) {
          cachedAccessToken = response.access_token;
          localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, response.access_token);
          resolve(response.access_token);
        } else {
          resolve(null);
        }
      };
      client.error_callback = () => resolve(null);
      client.requestAccessToken({ prompt: '' }); // '' = silent, no UI if possible
    });
  } catch {
    return null;
  }
};

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
      if (storedToken) {
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Try a silent renewal first before forcing the user to log in again.
        const refreshed = await silentTokenRefresh();
        if (refreshed) {
          if (onAuthSuccess) onAuthSuccess(user, refreshed);
        } else {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('mente-viva-google-token');
};
