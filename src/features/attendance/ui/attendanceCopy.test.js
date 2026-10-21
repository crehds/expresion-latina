import {
  ADMIN_ATTENDANCE_TITLE,
  ADMIN_READ_ERROR,
  ALREADY_STARTED,
  CANCEL_ATTENDANCE,
  CONFIRMED,
  CONFIRM_ATTENDANCE,
  DATE_UNAVAILABLE,
  LOADING_ATTENDEES,
  MISMATCH_TITLE,
  NOT_ACTIVE,
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
  occurrenceLine,
} from './attendanceCopy';

describe('attendanceCopy', () => {
  it('has the fixed texts of the controls', () => {
    expect(CONFIRM_ATTENDANCE).toBe('Confirmar asistencia');
    expect(CANCEL_ATTENDANCE).toBe('Cancelar asistencia');
    expect(CONFIRMED).toBe('Confirmaste tu asistencia.');
    expect(NOT_ACTIVE).toBe('Tu membresía no está activa.');
    expect(NOT_COVERED).toBe('Tu membresía no cubre esta clase.');
    expect(WHATSAPP_LINK_TEXT).toBe('Escríbenos por WhatsApp');
    expect(ALREADY_STARTED).toBe('Esta clase ya empezó.');
    expect(READ_ERROR).toBe('No pudimos cargar tu asistencia.');
    expect(RETRY).toBe('Reintentar');
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
