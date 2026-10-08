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

api.interceptors.request.use((request) => {
  if (!['get', 'head', 'options'].includes((request.method || 'get').toLowerCase()) && csrfToken) {
    request.headers['X-CSRF-Token'] = csrfToken;
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
