/**
 * Adapts one poster record from the API into the shape Poster.jsx renders.
 *
 * Records come from an upload service and are not guaranteed to be complete,
 * so anything unusable is dropped rather than rendered as a broken image.
 * Callers are expected to filter the nulls out.
 *
 * @param {object} poster raw API record
 * @returns {{id: string, filename: string, url: string}|null}
 */
function createAdaptedPoster(poster) {
  if (!poster || typeof poster !== 'object') return null;

  const {
    _id: id, originalname, publicUrl,
  } = poster;

  // publicUrl has been seen both as a bare string and as a { value } wrapper.
  const url = typeof publicUrl === 'string' ? publicUrl : publicUrl?.value;

  if (typeof url !== 'string' || !url.trim()) return null;

  return {
    id: id || url,
    filename: originalname || 'Poster',
    url,
  };
}

export default createAdaptedPoster;
