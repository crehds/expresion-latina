/**
 * The Spanish copy of the member directory, for the administrator.
 *
 * Every message is fixed text. A failed call shows the message of its result
 * code and nothing the backend said, so no raw error and no member data can
 * reach the screen. Dates of a payment go through `formatDateOnly`, which writes
 * a calendar day as the same day in every time zone.
 */
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { formatDateOnly } from '../../../shared/dateOnly';

export const SEARCH_LABEL = 'Buscar por nombre o correo';
export const SEARCH_BUTTON = 'Buscar';
export const SEARCHING = 'Buscando…';
export const NO_MATCHES = 'No encontramos miembros con esa búsqueda.';
export const NO_MEMBERS = 'Todavía no hay miembros.';
// Why a person who signed up may be missing: the directory is the members who
// accepted the privacy notice and confirmed their email.
export const DIRECTORY_SCOPE = 'Solo aparecen quienes aceptaron el aviso de privacidad y confirmaron su correo.';

export const ACTIVE = 'Activo';
export const INACTIVE = 'Inactivo';
export const NO_PAYMENTS = 'Sin pagos registrados';

export const DEFAULT_SEARCH_ERROR = 'No pudimos buscar a los miembros. Inténtalo de nuevo.';

// A Map, so that an inherited name such as "constructor" is never a code.
const SEARCH_ERRORS = new Map([
  [RESULT_CODES.NETWORK, 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
  [
    RESULT_CODES.FORBIDDEN,
    'No tienes permiso para ver a los miembros o tu sesión venció. Vuelve a ingresar.',
  ],
]);

/** The message for the code of a failed search; any code without its own gets the generic one. */
export const searchErrorMessage = (code) => SEARCH_ERRORS.get(code) ?? DEFAULT_SEARCH_ERROR;

export const membersFound = (count) => (count === 1 ? '1 miembro' : `${count} miembros`);

export const resultsLimited = (limit) => (
  `Mostramos solo los primeros ${limit} resultados. `
  + 'Escribe más del nombre o del correo para afinar la búsqueda.'
);

/** For a member who is active: the last day their periods cover. */
export const paidUntilText = (isoDate) => `Pagado hasta ${formatDateOnly(isoDate)}`;

/**
 * For a member who is not active: the end of the latest period they ever had,
 * which may lie in the future when their only period has not begun yet.
 */
export const lastDueText = (isoDate) => `Último vencimiento: ${formatDateOnly(isoDate)}`;
