/**
 * The Spanish copy of the attendance controls on the public schedule, for a
 * signed-in member.
 *
 * Every message is fixed text. A failed call shows the message of its result code
 * and nothing the backend said, so no raw error and no member data can reach the
 * screen. Dates go through `formatDateOnlyOrNull`, which writes a calendar day as
 * the same day in every time zone and never throws: a date that is no calendar
 * day gets a neutral line instead of taking the page down.
 */
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { formatDateOnlyOrNull } from '../../../shared/dateOnly';

export const CONFIRM_ATTENDANCE = 'Confirmar asistencia';
export const CANCEL_ATTENDANCE = 'Cancelar asistencia';
export const CONFIRMED = 'Confirmaste tu asistencia.';

export const NOT_ACTIVE = 'Tu membresía no está activa.';
// A member who is active today but whose periods stop before this class, when the
// day they stop cannot be written.
export const NOT_COVERED = 'Tu membresía no cubre esta clase.';
export const WHATSAPP_LINK_TEXT = 'Escríbenos por WhatsApp';

export const ALREADY_STARTED = 'Esta clase ya empezó.';

/** Which class the control is about, or null when its date cannot be written. */
export function classDateText(isoDate) {
  const date = formatDateOnlyOrNull(isoDate);
  return date === null ? null : `Próxima clase: ${date}`;
}

/** For a class after the end of the membership: the last day it covers. */
export function expiresText(isoDate) {
  const date = formatDateOnlyOrNull(isoDate);
  return date === null ? NOT_COVERED : `Tu membresía vence el ${date}.`;
}

const DEFAULT_ERROR = 'No pudimos actualizar tu asistencia. Inténtalo de nuevo.';

// A Map, so that an inherited name such as "constructor" is never a code.
const ERRORS = new Map([
  [RESULT_CODES.STARTED, ALREADY_STARTED],
  [
    RESULT_CODES.FORBIDDEN,
    'No pudimos confirmar tu asistencia. Revisa que tu membresía cubra esa fecha.',
  ],
  [RESULT_CODES.NETWORK, 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
]);

/** The message for the code of a failed action; a code without its own gets the generic one. */
export const attendanceErrorMessage = (code) => ERRORS.get(code) ?? DEFAULT_ERROR;

// The notice above the schedule when the member's attendance could not be read.
export const READ_ERROR = 'No pudimos cargar tu asistencia.';
export const RETRY = 'Reintentar';
