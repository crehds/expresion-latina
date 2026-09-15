import posterCasting from '../../../assets/images/posters/Poster_Casting.jpg';
import posterCasting2 from '../../../assets/images/posters/Poster_Casting2.jpg';
import programaZoom from '../../../assets/images/posters/programa_zoom.jpg';
import programaZoom2 from '../../../assets/images/posters/programa_zoom2.jpg';
import preciosZoom from '../../../assets/images/posters/precios_zoom.jpg';

/**
 * Posters bundled with the app, in the shape the adapter produces.
 *
 * The home carousel renders these whenever the remote poster API is not
 * configured or cannot be reached, so the hero is never empty.
 */
const FALLBACK_POSTERS = [
  { id: 'casting', filename: 'Casting de la academia', url: posterCasting },
  { id: 'casting-2', filename: 'Casting: convocatoria', url: posterCasting2 },
  { id: 'programa', filename: 'Programa de clases', url: programaZoom },
  { id: 'programa-2', filename: 'Programa de clases: detalle', url: programaZoom2 },
  { id: 'precios', filename: 'Precios de las clases', url: preciosZoom },
];

export default FALLBACK_POSTERS;
