/**
 * Whether a value is an id in the written form the database prints: a UUID of
 * eight, four, four, four and twelve hexadecimal digits joined by hyphens.
 *
 * It is the question to ask of anything taken from an address before it goes
 * into a request: a member's page reads the id from its path, and a value that
 * is not an id must be answered as "not found" without calling the backend. The
 * check is strict on purpose. The database would also take an id between braces
 * or without hyphens, but the app only ever writes the plain form, so anything
 * else is not an id of ours. It does not look at the version or variant digits.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean} false for anything that is not text
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export default isUuid;
