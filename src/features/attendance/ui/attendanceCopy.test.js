import {
  ALREADY_STARTED,
  CANCEL_ATTENDANCE,
  CONFIRMED,
  CONFIRM_ATTENDANCE,
  NOT_ACTIVE,
  NOT_COVERED,
  WHATSAPP_LINK_TEXT,
  attendanceErrorMessage,
  classDateText,
  expiresText,
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
