import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Web Client ID from Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
const GOOGLE_WEB_CLIENT_ID = '431861011757-6tr0d52botic6c3uqebsq9iuks4pplck.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// O token do Google dura ~1 hora. Guardamos junto o horário de validade
// para nunca usar (nem confiar em) um token que já venceu.
const TOKEN_KEY = 'mente-viva-google-token-v2';
const LEGACY_TOKEN_KEY = 'mente-viva-google-token'; // formato antigo, sem validade
const LAST_EMAIL_KEY = 'mente-viva-last-email';
const SAFETY_MARGIN_MS = 2 * 60 * 1000; // renova 2 min antes de vencer
const DEFAULT_LIFETIME_MS = 55 * 60 * 1000;

interface StoredToken {
  token: string;
  expiresAt: number;
}

let cached: StoredToken | null = null;
let isSigningIn = false;

function readStored(): StoredToken | null {
  if (cached) return cached;
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token && typeof parsed.expiresAt === 'number') {
      cached = parsed;
      return cached;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveToken(token: string, lifetimeMs: number = DEFAULT_LIFETIME_MS) {
  cached = { token, expiresAt: Date.now() + lifetimeMs };
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(cached));
  } catch {
    /* ignore */
  }
}

/** Esquece o token atual (memória + armazenamento). */
export const invalidateToken = () => {
  cached = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

/** Retorna o token só se ele ainda estiver dentro da validade. */
export const getValidToken = (): string | null => {
  const stored = readStored();
  if (stored && stored.expiresAt - Date.now() > SAFETY_MARGIN_MS) return stored.token;
  return null;
};

export const getAccessToken = async (): Promise<string | null> => getValidToken();

export const setCachedAccessToken = (token: string | null) => {
  if (token) saveToken(token);
  else invalidateToken();
};

const getLastEmail = (): string | null => {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY);
  } catch {
    return null;
  }
};

function waitForGis(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if ((window as any).google?.accounts?.oauth2) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      setTimeout(check, 100);
    };
    check();
  });
}

/**
 * Tenta renovar o token SEM mostrar tela de login (usa a sessão Google já
 * existente). Só uma tentativa por vez: chamadas simultâneas compartilham
 * o mesmo resultado, o que evita pop-ups repetidos em sequência.
 * Retorna null se não for possível (aí o app pede um clique em "Entrar").
 */
let refreshInFlight: Promise<string | null> | null = null;

export const silentTokenRefresh = (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doSilentRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

async function doSilentRefresh(): Promise<string | null> {
  try {
    const gisReady = await waitForGis(4000);
    if (!gisReady) return null;

    const email = auth.currentUser?.email || getLastEmail() || undefined;

    return await new Promise<string | null>((resolve) => {
      let done = false;
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 10000);

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_WEB_CLIENT_ID,
        scope: SHEETS_SCOPE,
        hint: email, // evita a tela "Escolha uma conta"
        callback: (response: any) => {
          if (response?.access_token) {
            const seconds = Number(response.expires_in) || 3600;
            saveToken(response.access_token, Math.max(seconds * 1000 - 5 * 60 * 1000, 60 * 1000));
            finish(response.access_token);
          } else {
            finish(null);
          }
        },
        error_callback: () => finish(null),
      });
      client.requestAccessToken({ prompt: '', hint: email });
    });
  } catch {
    return null;
  }
}

/**
 * Observa o login do Firebase. Ao carregar a página:
 *  - token ainda válido -> entra direto;
 *  - token vencido -> UMA tentativa silenciosa; se falhar, avisa o app
 *    (onAuthFailure('expired')) para mostrar o botão de entrar. Sem loops.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (reason: 'expired' | 'signed-out') => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (user.email) {
        try {
          localStorage.setItem(LAST_EMAIL_KEY, user.email);
        } catch {
          /* ignore */
        }
      }
      const valid = getValidToken();
      if (valid) {
        onAuthSuccess?.(user, valid);
        return;
      }
      if (isSigningIn) return; // o fluxo de login em andamento cuida disso
      const refreshed = await silentTokenRefresh();
      if (refreshed) {
        onAuthSuccess?.(user, refreshed);
      } else {
        invalidateToken();
        onAuthFailure?.('expired');
      }
    } else {
      invalidateToken();
      onAuthFailure?.('signed-out');
    }
  });
};

/**
 * Login único (um só pop-up) já com permissão da planilha.
 * Precisa ser chamado direto de um clique, sem nada "await" antes.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    provider.addScope(SHEETS_SCOPE);
    const lastEmail = getLastEmail();
    if (lastEmail) provider.setCustomParameters({ login_hint: lastEmail });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    saveToken(credential.accessToken);
    if (result.user.email) {
      try {
        localStorage.setItem(LAST_EMAIL_KEY, result.user.email);
      } catch {
        /* ignore */
      }
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await auth.signOut();
  invalidateToken();
  try {
    localStorage.removeItem(LAST_EMAIL_KEY);
  } catch {
    /* ignore */
  }
};
