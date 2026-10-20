/**
 * The Spanish copy of the membership screens, for the administrator: the member
 * directory, and the page of one member with the payments recorded for them.
 *
 * Every message is fixed text. A failed call shows the message of its result
 * code and nothing the backend said, so no raw error and no member data can
 * reach the screen. Dates of a payment go through `formatDateOnlyOrNull`, which
 * writes a calendar day as the same day in every time zone and never throws: a
 * date from the server that is no calendar day gets a neutral line, so one bad
 * row cannot take the screen down while it renders.
 */
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { formatDateOnlyOrNull } from '../../../shared/dateOnly';

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

// What every failed call says when there was no answer at all.
const CONNECTION_LOST = 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';

// A Map, so that an inherited name such as "constructor" is never a code.
const SEARCH_ERRORS = new Map([
  [RESULT_CODES.NETWORK, CONNECTION_LOST],
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

// What a payment line says when the server sent a date that is no calendar day.
export const PAYMENT_DATE_UNAVAILABLE = 'Fecha de pago no disponible';

// The line for a payment date, or the neutral one when there is no date to write.
function paymentDateLine(isoDate, write) {
  const written = formatDateOnlyOrNull(isoDate);
  return written === null ? PAYMENT_DATE_UNAVAILABLE : write(written);
}

/** For a member who is active: the last day their periods cover. */
export const paidUntilText = (isoDate) => paymentDateLine(isoDate, (date) => `Pagado hasta ${date}`);

/**
 * For a member who is not active: the end of the latest period they ever had,
 * which may lie in the future when their only period has not begun yet.
 */
export const lastDueText = (isoDate) => paymentDateLine(
  isoDate,
  (date) => `Último vencimiento: ${date}`,
);

// The form of a payment (a paid period): record a new one, or correct one.
export const CREATE_PERIOD_TITLE = 'Registrar pago';
export const EDIT_PERIOD_TITLE = 'Editar pago';
export const STARTS_ON_LABEL = 'Fecha de inicio';
export const ENDS_ON_LABEL = 'Fecha de fin';
export const END_SHORTCUTS_LABEL = 'Atajos para la fecha de fin';
export const ADD_ONE_MONTH = '+1 mes';
export const ADD_ONE_YEAR = '+1 año';
export const SAVE_PERIOD = 'Guardar';
export const SAVING_PERIOD = 'Guardando…';
export const CANCEL = 'Cancelar';

// What is wrong with a field, by the key `validatePeriod` gives. A Map, so that
// an inherited name such as "constructor" is never a key.
const PERIOD_FIELD_MESSAGES = new Map([
  ['startsOn', new Map([
    ['required', 'Indica la fecha de inicio.'],
    ['invalid', 'La fecha de inicio no es válida.'],
  ])],
  ['endsOn', new Map([
    ['required', 'Indica la fecha de fin.'],
    ['invalid', 'La fecha de fin no es válida.'],
    ['before_start', 'La fecha de fin no puede ser anterior a la de inicio.'],
  ])],
]);

/** The message for a problem of a field, or undefined when there is none for it. */
export const periodFieldMessage = (field, problem) => (
  PERIOD_FIELD_MESSAGES.get(field)?.get(problem)
);

// The payment is gone: it was deleted meanwhile, and the list is read again.
const PERIOD_GONE = 'Este pago ya no existe. Mostramos la lista al día.';

export const DEFAULT_SAVE_PERIOD_ERROR = 'No pudimos guardar el pago. Inténtalo de nuevo.';

// The database refuses a period that ends before it starts or lasts longer than
// five years (INVALID), and one that overlaps another period of the same member
// (OVERLAP); neither rule is checked in the browser.
const SAVE_PERIOD_ERRORS = new Map([
  [
    RESULT_CODES.INVALID,
    'Revisa las fechas: el fin no puede ser anterior al inicio y un pago no puede durar más de 5 años.',
  ],
  [
    RESULT_CODES.OVERLAP,
    'Esas fechas se cruzan con otro pago de este miembro. Cambia las fechas e inténtalo de nuevo.',
  ],
  [RESULT_CODES.NOT_FOUND, PERIOD_GONE],
  [
    RESULT_CODES.FORBIDDEN,
    'No tienes permiso para guardar este pago o tu sesión venció. Vuelve a ingresar.',
  ],
  [RESULT_CODES.NETWORK, CONNECTION_LOST],
]);

/** The message for the code of a payment that could not be saved. */
export const savePeriodErrorMessage = (code) => (
  SAVE_PERIOD_ERRORS.get(code) ?? DEFAULT_SAVE_PERIOD_ERROR
);
