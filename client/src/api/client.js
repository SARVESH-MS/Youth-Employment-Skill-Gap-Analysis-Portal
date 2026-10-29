import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

let refreshing;
let csrfToken = '';
let csrfPromise;

api.interceptors.request.use(async (request) => {
  const method = (request.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    // Initialize protection even when a screen sends a write before the auth
    // provider has completed its startup request.
    const token = await ensureCsrf();
    request.headers['X-CSRF-Token'] = token;
  }
  return request;
});

export async function ensureCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  csrfPromise ||= api.get('/auth/csrf').then((response) => {
    csrfToken = response.headers?.['x-csrf-token'] || response.data?.data?.token || '';
    if (!csrfToken) throw new Error('Could not initialize secure session protection. Please reload the page.');
    return csrfToken;
  }).finally(() => { csrfPromise = null; });
  return csrfPromise;
}

api.interceptors.response.use((response) => {
  const nextToken = response.headers?.['x-csrf-token'];
  if (nextToken) csrfToken = nextToken;
  else if (response.config?.url?.endsWith('/auth/logout')) csrfToken = '';
  return response;
}, async (error) => {
  const request = error.config;
  const isAuthRoute = request?.url?.startsWith('/auth/') || request?.url?.startsWith('auth/');
  const isCsrfRejection = error.response?.status === 403
    && error.response?.data?.message === 'A valid CSRF token is required for this request';
  if (isCsrfRejection && request && !request._csrfRetried) {
    request._csrfRetried = true;
    try {
      // A token can become stale when the session cookie is renewed in another
      // tab or after a deployment. Fetch the cookie/header pair again, then
      // retry this request once with the synchronized token.
      await ensureCsrf(true);
      return api(request);
    } catch {
      return Promise.reject(error);
    }
  }
  if (error.response?.status === 401 && request && !request._retried && !isAuthRoute) {
    request._retried = true;
    try {
      refreshing ||= api.post('/auth/refresh').finally(() => { refreshing = null; });
      await refreshing;
      return api(request);
    } catch {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('yesgap:session-expired'));
      return Promise.reject(error);
    }
  }
  return Promise.reject(error);
});

export const dataOf = (response) => response.data?.data;
export const errorMessage = (error) => error.response?.data?.message || error.message || 'Something went wrong.';
export default api;
