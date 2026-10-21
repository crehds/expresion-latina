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

// The administrator's attendee list (Spec: Admin-Only Attendee Visibility).
export const ADMIN_ATTENDANCE_TITLE = 'Asistencia';
export const LOADING_ATTENDEES = 'Cargando las confirmaciones…';
export const NO_ATTENDEES = 'Nadie ha confirmado todavía.';
// Fixed for every failed read: the list shows the code of nothing and the text of
// no error, so no member data can reach the screen through it.
export const ADMIN_READ_ERROR = 'No pudimos cargar las confirmaciones de asistencia.';
// The schedule could not be compared with the confirmations, so the list is shown
// without telling which of them stopped matching.
export const SCHEDULE_COMPARE_ERROR = 'No pudimos comparar las confirmaciones con el horario actual.';
// The title of the confirmations whose class is no longer in the schedule; the
// words are fixed by the spec (Schedule Changes).
export const MISMATCH_TITLE = 'Ya no coincide con el horario';
// A member whose profile did not come with the confirmation, or has no name.
export const UNNAMED_MEMBER = 'Miembro sin nombre';
export const DATE_UNAVAILABLE = 'Fecha no disponible';

/** How many people confirmed a class. */
export const attendeeCount = (count) => (count === 1 ? '1 persona' : `${count} personas`);

/**
 * Where and when a stored class was: the date, the times and the room, as they
 * were written when the member confirmed. A date that is no calendar day gets a
 * neutral line instead of taking the list down.
 */
export const occurrenceLine = ({
  classDate, startTime, endTime, roomLabel,
}) => (
  `${formatDateOnlyOrNull(classDate) ?? DATE_UNAVAILABLE} · ${startTime} a ${endTime} · ${roomLabel}`
);

// The notice above the schedule when the member's attendance could not be read.
export const READ_ERROR = 'No pudimos cargar tu asistencia.';
export const RETRY = 'Reintentar';
