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

// The names of the toggle of a class (its aria-label): the action it performs.
export const CONFIRM_ATTENDANCE = 'Confirmar asistencia';
export const CANCEL_ATTENDANCE = 'Cancelar asistencia';
// The caption next to the toggle of a class the member has confirmed.
export const CONFIRMED = 'Vas a esta clase';

// The one notice above the schedule for a signed-in member whose membership is not
// active today. It says so and invites to enrol; the link to WhatsApp that goes with
// it is WHATSAPP_LINK_TEXT. The wording is a draft for the owner's review.
export const INACTIVE_NOTICE = 'Tu membresía no está activa. '
  + 'Matricúlate para confirmar tu asistencia a las clases.';

// The prompt that the check of a card opens for a member with no active membership,
// and that a refused confirm opens when the membership turns out to have lapsed. The
// wording is a draft for the owner's review, like the notice above.
export const MEMBERSHIP_MODAL_TITLE = 'Necesitas una membresía activa';
export const MEMBERSHIP_MODAL_TEXT = 'Para confirmar tu asistencia, primero matricúlate. '
  + 'Escríbenos por WhatsApp y te ayudamos con el pago.';
export const MEMBERSHIP_MODAL_CLOSE = 'Cerrar';
export const MEMBERSHIP_MODAL_SCRIM = 'Cerrar aviso';

// The legend above the schedule: "Toca (check) para confirmar tu asistencia y (X)
// para cancelarla." The two icons are drawn between these words, as real elements,
// and each has a name for a screen reader.
export const LEGEND_TOUCH = 'Toca';
export const LEGEND_CONFIRM_WORDS = 'para confirmar tu asistencia y';
export const LEGEND_CANCEL_WORDS = 'para cancelarla.';
export const LEGEND_CHECK_NAME = 'el check';
export const LEGEND_CROSS_NAME = 'la equis';
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
