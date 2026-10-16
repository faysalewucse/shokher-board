import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Extract base URL for file uploads (without /api/v1 suffix)
export const SERVER_BASE_URL = API_BASE_URL.replace('/api/v1', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Convert relative file paths to full URLs
export const getFileUrl = (filePath) => {
  if (!filePath) return null;

  // If it's already a full URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  // Construct full URL for relative paths
  return `${SERVER_BASE_URL}${filePath}`;
};

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shokherboard.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — but don't hijack a failed login (a wrong-password 401
// must reach the Login page so it can show the error). Only force a redirect
// for 401s on other requests (e.g. an expired session) and not when we're
// already on the login page.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isOnLoginPage = ['/login', '/register'].includes(window.location.pathname);
    if (error.response?.status === 401 && !isLoginRequest && !isOnLoginPage) {
      localStorage.removeItem('shokherboard.token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
