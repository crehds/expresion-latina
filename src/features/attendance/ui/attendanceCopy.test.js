import {
  ADMIN_ATTENDANCE_TITLE,
  ADMIN_READ_ERROR,
  ALREADY_STARTED,
  CANCEL_ATTENDANCE,
  CONFIRMED,
  CONFIRM_ATTENDANCE,
  DATE_UNAVAILABLE,
  LEGEND_CANCEL_WORDS,
  LEGEND_CHECK_NAME,
  LEGEND_CROSS_NAME,
  LEGEND_CONFIRM_WORDS,
  LEGEND_TOUCH,
  LOADING_ATTENDEES,
  MEMBERSHIP_MODAL_CLOSE,
  MEMBERSHIP_MODAL_TITLE,
  MISMATCH_TITLE,
  NOT_COVERED,
  NO_ATTENDEES,
  READ_ERROR,
  RETRY,
  SCHEDULE_COMPARE_ERROR,
  UNNAMED_MEMBER,
  WHATSAPP_LINK_TEXT,
  attendanceErrorMessage,
  attendeeCount,
  classDateText,
  expiresText,
  membershipModalCopy,
  occurrenceLine,
} from './attendanceCopy';

describe('attendanceCopy', () => {
  it('has the fixed texts of the controls', () => {
    expect(CONFIRM_ATTENDANCE).toBe('Confirmar asistencia');
    expect(CANCEL_ATTENDANCE).toBe('Cancelar asistencia');
    expect(CONFIRMED).toBe('Vas a esta clase');
    expect(NOT_COVERED).toBe('Tu membresía no cubre esta clase.');
    expect(WHATSAPP_LINK_TEXT).toBe('Escríbenos por WhatsApp');
    expect(ALREADY_STARTED).toBe('Esta clase ya empezó.');
    expect(READ_ERROR).toBe('No pudimos cargar tu asistencia.');
    expect(RETRY).toBe('Reintentar');
  });

  // The prompt that a check opens for a member with no active membership, and the
  // legend above the schedule (drafts for the owner's review).
  it('has the texts of the prompt to enrol', () => {
    expect(MEMBERSHIP_MODAL_TITLE).toBe('Necesitas una membresía activa');
    expect(MEMBERSHIP_MODAL_CLOSE).toBe('Cerrar');
  });

  // The owner settled this copy (2026-10-22): "y te ayudamos con el pago" is gone, and the
  // sentence about WhatsApp goes when the studio has no WhatsApp.
  describe('membershipModalCopy', () => {
    it('asks a member with no membership to enrol, and points to WhatsApp when there is a link', () => {
      expect(membershipModalCopy({ kind: 'enrol' }, true)).toEqual({
        title: 'Necesitas una membresía activa',
        text: 'Para confirmar tu asistencia, primero matricúlate. Escríbenos por WhatsApp.',
      });
    });

    it('drops the sentence about WhatsApp when there is no link', () => {
      expect(membershipModalCopy({ kind: 'enrol' }, false)).toEqual({
        title: 'Necesitas una membresía activa',
        text: 'Para confirmar tu asistencia, primero matricúlate.',
      });
    });

    // Option A (owner): an early start is something the member asks for and the admin does.
    it('tells a member whose membership starts later the day it starts, and how to ask for an earlier one', () => {
      expect(membershipModalCopy({ kind: 'starts-later', startsOn: '2026-11-03' }, true)).toEqual({
        title: 'Tu membresía empieza el 3 de noviembre de 2026',
        text: 'Si quieres empezar antes, escríbenos por WhatsApp.',
      });
    });

    it('sends them to the academy when there is no WhatsApp link', () => {
      expect(membershipModalCopy({ kind: 'starts-later', startsOn: '2026-11-03' }, false)).toEqual({
        title: 'Tu membresía empieza el 3 de noviembre de 2026',
        text: 'Si quieres empezar antes, acércate a la academia.',
      });
    });

    it('writes the day as the same day in every zone, with no leading zero', () => {
      expect(membershipModalCopy({ kind: 'starts-later', startsOn: '2027-01-01' }, true).title)
        .toBe('Tu membresía empieza el 1 de enero de 2027');
    });

    it.each(['soon', '', null, undefined, '2026-02-30'])(
      'falls back to the plain invitation when the day %j cannot be written',
      (startsOn) => {
        expect(membershipModalCopy({ kind: 'starts-later', startsOn }, true))
          .toEqual(membershipModalCopy({ kind: 'enrol' }, true));
      },
    );

    it.each([null, undefined])('is the plain invitation for no prompt (%s)', (prompt) => {
      expect(membershipModalCopy(prompt, true).title).toBe('Necesitas una membresía activa');
    });
  });

  it('has the words of the legend, which the two icons are drawn between', () => {
    expect(LEGEND_TOUCH).toBe('Toca');
    expect(LEGEND_CONFIRM_WORDS).toBe('para confirmar tu asistencia y');
    expect(LEGEND_CANCEL_WORDS).toBe('para cancelarla.');
    expect(LEGEND_CHECK_NAME).toBe('el check');
    expect(LEGEND_CROSS_NAME).toBe('la equis');
  });

  it('has the fixed texts of the administrator\'s list', () => {
    expect(ADMIN_ATTENDANCE_TITLE).toBe('Asistencia');
    expect(LOADING_ATTENDEES).toBe('Cargando las confirmaciones…');
    expect(NO_ATTENDEES).toBe('Nadie ha confirmado todavía.');
    expect(ADMIN_READ_ERROR).toBe('No pudimos cargar las confirmaciones de asistencia.');
    expect(SCHEDULE_COMPARE_ERROR).toBe(
      'No pudimos comparar las confirmaciones con el horario actual.',
    );
    expect(MISMATCH_TITLE).toBe('Ya no coincide con el horario');
    expect(UNNAMED_MEMBER).toBe('Miembro sin nombre');
    expect(DATE_UNAVAILABLE).toBe('Fecha no disponible');
  });

  describe('attendeeCount', () => {
    it('counts in the singular and the plural', () => {
      expect(attendeeCount(1)).toBe('1 persona');
      expect(attendeeCount(2)).toBe('2 personas');
      expect(attendeeCount(12)).toBe('12 personas');
    });
  });

  describe('occurrenceLine', () => {
    const stored = {
      classDate: '2026-10-26', startTime: '19:00', endTime: '20:00', roomLabel: 'Sala 1',
    };

    it('writes the date, the times and the room of the stored class', () => {
      expect(occurrenceLine(stored)).toBe('26 de octubre de 2026 · 19:00 a 20:00 · Sala 1');
    });

    it.each(['', 'soon', '2026-02-30', null, undefined])(
      'falls back to the neutral date for %s',
      (classDate) => {
        expect(occurrenceLine({ ...stored, classDate })).toBe('Fecha no disponible · 19:00 a 20:00 · Sala 1');
      },
    );
  });

  describe('classDateText', () => {
    it('writes the calendar day as the same day in every zone', () => {
      expect(classDateText('2026-10-26')).toBe('Próxima clase: 26 de octubre de 2026');
      expect(classDateText('2026-01-01')).toBe('Próxima clase: 1 de enero de 2026');
    });

    it.each(['', 'soon', '2026-02-30', null, undefined])('is null for %s', (value) => {
      expect(classDateText(value)).toBeNull();
    });
  });

  describe('expiresText', () => {
    it('says the day the membership runs to', () => {
      expect(expiresText('2026-10-31')).toBe('Tu membresía vence el 31 de octubre de 2026.');
    });

    it.each(['', 'soon', '2026-02-30', null, undefined])(
      'falls back to the neutral line for %s',
      (value) => {
        expect(expiresText(value)).toBe('Tu membresía no cubre esta clase.');
      },
    );
  });

  describe('attendanceErrorMessage', () => {
    it('says a started class has started', () => {
      expect(attendanceErrorMessage('STARTED')).toBe('Esta clase ya empezó.');
    });

    it('asks to check the membership after a refusal', () => {
      expect(attendanceErrorMessage('FORBIDDEN')).toBe(
        'No pudimos confirmar tu asistencia. Revisa que tu membresía cubra esa fecha.',
      );
    });

    it('tells a lost connection', () => {
      expect(attendanceErrorMessage('NETWORK')).toBe(
        'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
      );
    });

    it.each(['UNKNOWN', 'INVALID', 'constructor', '', undefined, null])(
      'has a generic message for %s',
      (code) => {
        expect(attendanceErrorMessage(code)).toBe(
          'No pudimos actualizar tu asistencia. Inténtalo de nuevo.',
        );
      },
    );
  });
});
