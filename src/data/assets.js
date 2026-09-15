import bachataIzquierdo from '../assets/images/teachers/bachata_izquierdo.jpg';
import balletMartinez from '../assets/images/teachers/ballet_martinez.jpg';
import bodyKike from '../assets/images/teachers/body_kike.jpg';
import hellsPedro from '../assets/images/teachers/hells_pedro.jpg';
import jazzStephany from '../assets/images/teachers/jazz_stephany.jpg';
import ladiesMary from '../assets/images/teachers/ladies_mary.jpg';
import latinEstrella from '../assets/images/teachers/latin_estrella.jpg';
import mamboJoan from '../assets/images/teachers/mambo_joan.jpg';
import mishelFernandez from '../assets/images/teachers/mishel_fernandez.jpg';
import urbanPovis from '../assets/images/teachers/urban_povis.jpg';

import comoLlegar from '../assets/videos/como_llegar.mp4';
import ladiesLatinas from '../assets/videos/ladies_latinas.mp4';
import videoCorto from '../assets/videos/video_corto.mp4';
import videoLargo from '../assets/videos/video_largo.mp4';

/**
 * academy.json is data, so it cannot import an image the way a module can.
 * It stores file names instead, and these maps turn them into bundled URLs.
 *
 * The maps are written out explicitly rather than built with require.context,
 * which only exists under webpack and would have to be rewritten to migrate
 * off Create React App. Being explicit also means adding a teacher without
 * registering their image fails in review instead of in production — the
 * academy.json test asserts every imageKey resolves here.
 */
export const TEACHER_IMAGES = Object.freeze({
  'bachata_izquierdo.jpg': bachataIzquierdo,
  'ballet_martinez.jpg': balletMartinez,
  'body_kike.jpg': bodyKike,
  'hells_pedro.jpg': hellsPedro,
  'jazz_stephany.jpg': jazzStephany,
  'ladies_mary.jpg': ladiesMary,
  'latin_estrella.jpg': latinEstrella,
  'mambo_joan.jpg': mamboJoan,
  'mishel_fernandez.jpg': mishelFernandez,
  'urban_povis.jpg': urbanPovis,
});

export const VIDEO_ASSETS = Object.freeze({
  'como_llegar.mp4': comoLlegar,
  'ladies_latinas.mp4': ladiesLatinas,
  'video_corto.mp4': videoCorto,
  'video_largo.mp4': videoLargo,
});

/** @returns {string|undefined} bundled URL, or undefined when unregistered */
export function resolveTeacherImage(imageKey) {
  return TEACHER_IMAGES[imageKey];
}

/** @returns {string|undefined} bundled URL, or undefined when unregistered */
export function resolveVideoAsset(assetKey) {
  return VIDEO_ASSETS[assetKey];
}
