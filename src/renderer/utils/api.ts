/**
 * HTTP client for management API and brain API.
 * Adds ngrok-skip-browser-warning header for remote agent compatibility.
 */

function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // bypass ngrok free tier interstitial
    ...(extra || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function manageFetch<T>(
  serverUrl: string,
  token: string | null,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = buildHeaders(token, options.headers as Record<string, string>);

  const res = await fetch(`${serverUrl}/api/web/manage${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function brainFetch<T>(
  serverUrl: string,
  token: string | null,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = buildHeaders(token, options.headers as Record<string, string>);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${serverUrl}/brain${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
