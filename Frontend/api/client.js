// src/services/api/client.js
import axios from "axios";
import { API_URL, API_TIMEOUT, clearAuthData, IS_PRODUCTION } from "./config";
import debugUtils from "../../utils/debug";

const { safeConsole } = debugUtils;

/* ===================== ACCESS TOKEN W PAMIĘCI (opcjonalny) ===================== */
/** Używamy głównie HttpOnly cookies. Authorization: Bearer jest opcjonalny
 * (np. gdy backend dopuszcza oba mechanizmy). */
let accessToken = null;
export const setAccessToken = (t) => {
  accessToken = t || null;
};
export const clearAccessToken = () => {
  accessToken = null;
};

/* ===================== LEKKI CACHE W PAMIĘCI ===================== */
const apiCache = new Map();
const MAX_CACHE_SIZE = 50;

/* ===================== STAŁE ŚCIEŻKI ADMINA ===================== */
const ADMIN_PREFIX = "/admin-panel";
const ADMIN_REFRESH_PATH = `${ADMIN_PREFIX}/auth/refresh`;

/* ===================== INSTANCJE AXIOS ===================== */
// Główna – do wszystkich zwykłych requestów
const apiClient = axios.create({
  baseURL: API_URL, // Np. http://localhost:5000
  timeout: API_TIMEOUT, // Np. 60000 ms
  withCredentials: true, // Cookie lecą do backendu
  headers: { Accept: "application/json" },
});

// Minimalna instancja do REFRESH (bez interceptorów)
const refreshClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

/* ===================== KOLEJKA PODCZAS REFRESH ===================== */
let refreshPromise = null;
const subscribers = [];
const subscribeTokenRefreshed = (cb) => subscribers.push(cb);
const notifySubscribers = (newAccess) => {
  while (subscribers.length) {
    const cb = subscribers.shift();
    try {
      cb(newAccess);
    } catch {}
  }
};

/* ===================== REQUEST INTERCEPTOR ===================== */
apiClient.interceptors.request.use(
  (config) => {
    // ✅ KROK 1: ZAWSZE dodaj token (z pamięci lub localStorage) jako pierwszy krok
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ KROK 2: SPECJALNA OBSŁUGA FormData - nie dotykaj Content-Type!
    if (config.data instanceof FormData) {
      // Usuń Content-Type aby axios dodał go sam z boundary
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];

      return config; // ← WYJDŹ WCZEŚNIEJ! Nie modyfikuj nic więcej
    }

    // ✅ KROK 3: Dla zwykłych danych (nie FormData) - ustaw JSON
    if (config.data) {
      config.headers["Content-Type"] = "application/json";
    }

    // Ostrzeżenie o dużych headerach (tylko development)
    if (!IS_PRODUCTION) {
      const headersStr = JSON.stringify(config.headers || {});
      if (headersStr.length > 700) {
        safeConsole.warn(
          `Nagłówki >700 znaków (${headersStr.length})`,
          config.method?.toUpperCase(),
          config.baseURL ? `${config.baseURL}${config.url}` : config.url,
        );
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* ===================== RESPONSE INTERCEPTOR ===================== */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    /* ---- 431: Request Header Fields Too Large ---- */
    if (error.response?.status === 431) {
      safeConsole.error(
        "HTTP 431: Nagłówki za duże – czyszczę cache i robię minimalny retry",
      );
      apiCache.clear();

      if (!originalRequest?._minimal_retry) {
        originalRequest._minimal_retry = true;
        const retryConfig = {
          ...originalRequest,
          headers: { Accept: "application/json" },
          withCredentials: true,
        };
        try {
          return await axios(retryConfig);
        } catch (retryErr) {
          safeConsole.error(
            "Minimalny retry po 431 nie powiódł się",
            retryErr?.response?.status,
          );
        }
      }
    }

    /* ---- 401: Odśwież sesję ---- */
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      // Jeśli refresh już trwa — podłącz do kolejki
      if (refreshPromise) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefreshed((newAccess) => {
            if (newAccess) {
              // Zaktualizuj token w headerach
              if (!originalRequest.headers) originalRequest.headers = {};
              originalRequest.headers.Authorization = `Bearer ${newAccess}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      // Start refresh
      refreshPromise = (async () => {
        try {
          // Określ ścieżkę refresh w zależności od tego czy to admin czy user
          const isAdminRequest = originalRequest.url?.includes("/admin-panel");
          const refreshPath = isAdminRequest
            ? ADMIN_REFRESH_PATH
            : "/api/auth/refresh";

          const { data } = await refreshClient.post(refreshPath);
          const newAccess = data?.accessToken;

          // accessToken może nie przyjść, jeśli używasz tylko cookies — to OK.
          if (newAccess) {
            setAccessToken(newAccess);
            // Zapisz również do localStorage jako fallback
            localStorage.setItem("token", newAccess);
          }

          notifySubscribers(newAccess || null);
          return newAccess || null;
        } catch (e) {
          safeConsole.error(
            "Odświeżenie sesji nieudane – wylogowuję",
            e?.response?.status,
          );
          notifySubscribers(null);
          try {
            await clearAuthData();
          } catch {}
          clearAccessToken();
          localStorage.removeItem("token");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login?expired=true";
          }
          throw e;
        } finally {
          refreshPromise = null;
        }
      })();

      try {
        const newAccess = await refreshPromise;
        if (newAccess) {
          // Zaktualizuj Authorization header
          if (!originalRequest.headers) originalRequest.headers = {};
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        } else {
          // Bez Bearera — polegamy na cookies
          if (originalRequest.headers) {
            delete originalRequest.headers.Authorization;
          }
        }
        return apiClient(originalRequest);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  },
);

/* ===================== CACHE – NARZĘDZIA ===================== */
apiClient.getCache = (key) => {
  const cached = apiCache.get(key);
  if (!cached) return null;
  if (cached.expiry && Date.now() > cached.expiry) {
    apiCache.delete(key);
    return null;
  }
  return cached.data;
};

apiClient.setCache = (key, data, ttl = 300000) => {
  if (apiCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = apiCache.keys().next().value;
    apiCache.delete(oldestKey);
  }
  apiCache.set(key, { data, expiry: Date.now() + ttl });
};

apiClient.clearCache = (key) => {
  if (key) apiCache.delete(key);
  else apiCache.clear();
};

apiClient.getCached = async (url, params = {}, ttl = 300000) => {
  const cacheKey = `${url}${JSON.stringify(params)}`;
  const cached = apiClient.getCache(cacheKey);
  if (cached) return { data: cached };
  const response = await apiClient.get(url, { params });
  apiClient.setCache(cacheKey, response.data, ttl);
  return response;
};

export default apiClient;
