/**
 * Resolve a stored image path against the API server origin.
 *
 * Server returns paths like "/uploads/avatars/foo.png" which the browser would
 * otherwise resolve against the portal's own origin (http://localhost:5173/...).
 * That gives a 404 because the files are served by the API (port 8000).
 *
 * Absolute URLs (http/https) are passed through unchanged so this is safe to
 * apply to any value, including legacy records or external CDN links.
 */
export const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const serverUrl =
    import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
    "http://localhost:8000";
  return `${serverUrl}${url}`;
};

export default getImageUrl;
