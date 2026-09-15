const API_URL = (process.env.REACT_APP_POSTERS_API_URL || '').trim();

const DEFAULT_TIMEOUT_MS = 8000;

/** Raised when the poster API is configured but cannot be used. */
export class PostersError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'PostersError';
    this.status = status;
  }
}

/** Whether a remote poster API is configured at all. */
export function hasRemotePosters() {
  return Boolean(API_URL);
}

/**
 * Fetches raw poster records from the API.
 *
 * Returns an empty array when no API is configured, so callers can always
 * fall back to the bundled posters without special-casing that.
 *
 * @param {{signal?: AbortSignal, timeoutMs?: number}} options
 * @returns {Promise<unknown[]>}
 * @throws {PostersError} when the API is configured but unusable
 */
export default async function getPosters({ signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!API_URL) return [];

  // A cold or reclaimed host can hang well past a page load, so bound it.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(`${API_URL}/posters`, { signal: controller.signal });

    if (!response.ok) {
      throw new PostersError(`Poster API responded ${response.status}`, response.status);
    }

    const payload = await response.json();

    // An error body such as { status: 'error' } would otherwise yield
    // undefined here and blow up in the caller's .map().
    if (!Array.isArray(payload?.data)) {
      throw new PostersError('Poster API returned no poster list');
    }

    return payload.data;
  } catch (error) {
    if (error instanceof PostersError) throw error;
    if (error.name === 'AbortError') throw new PostersError('Poster API timed out');
    throw new PostersError(error.message);
  } finally {
    clearTimeout(timeout);
  }
}
