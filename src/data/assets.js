/**
 * academy.json is data, so it cannot import an image the way a module can.
 * It stores file names instead, and these maps turn them into bundled URLs.
 *
 * The folders are read at build time rather than listed by hand: adding a
 * teacher's photograph is dropping the file in and naming it in the
 * spreadsheet, with no third step that is easy to forget. Vite resolves these
 * statically, so nothing unused reaches the bundle.
 */
function byFileName(modules) {
  return Object.freeze(Object.fromEntries(
    Object.entries(modules).map(([filePath, url]) => [filePath.split('/').pop(), url]),
  ));
}

export const TEACHER_IMAGES = byFileName(
  import.meta.glob('../assets/images/teachers/*.{jpg,jpeg,png,webp,avif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

export const VIDEO_ASSETS = byFileName(
  import.meta.glob('../assets/videos/*.{mp4,webm}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** @returns {string|undefined} bundled URL, or undefined when the file is missing */
export function resolveTeacherImage(imageKey) {
  return TEACHER_IMAGES[imageKey];
}

/** @returns {string|undefined} bundled URL, or undefined when the file is missing */
export function resolveVideoAsset(assetKey) {
  return VIDEO_ASSETS[assetKey];
}
