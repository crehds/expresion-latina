import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { validatePeriod } from '../domain/periodValidation';
import {
  BACK_TO_MEMBERS,
  DEFAULT_DELETE_PERIOD_ERROR,
  DEFAULT_MEMBER_ERROR,
  DEFAULT_SAVE_PERIOD_ERROR,
  DEFAULT_SEARCH_ERROR,
  LOADING_MEMBER,
  MEMBER_NOT_FOUND,
  MEMBER_NOT_FOUND_TITLE,
  MEMBER_TITLE,
  PAYMENT_DATE_UNAVAILABLE,
  PERIOD_DATES_UNAVAILABLE,
  RETRY,
  deletePeriodErrorMessage,
  deletePeriodLabel,
  editPeriodLabel,
  keepaliveStaleText,
  lastDueText,
  memberErrorMessage,
  membersFound,
  paidUntilText,
  paymentLine,
  periodFieldMessage,
  periodRangeText,
  resultsLimited,
  savePeriodErrorMessage,
  searchErrorMessage,
} from './membershipCopy';
import * as copy from './membershipCopy';

describe('searchErrorMessage', () => {
  it('tells a lost connection apart', () => {
    expect(searchErrorMessage(RESULT_CODES.NETWORK))
      .toBe('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  });

  it('tells a refused request apart, and asks for a new sign-in', () => {
    expect(searchErrorMessage(RESULT_CODES.FORBIDDEN))
      .toBe('No tienes permiso para ver a los miembros o tu sesión venció. Vuelve a ingresar.');
  });

  it.each(
    Object.values(RESULT_CODES).filter(
      (code) => ![RESULT_CODES.NETWORK, RESULT_CODES.FORBIDDEN].includes(code),
    ),
  )('gives the code %s the generic message', (code) => {
    expect(searchErrorMessage(code)).toBe(DEFAULT_SEARCH_ERROR);
  });

  it.each(['constructor', 'toString', '', undefined, null, 42])(
    'gives the generic message to %j, which is no code at all',
    (code) => {
      expect(searchErrorMessage(code)).toBe(DEFAULT_SEARCH_ERROR);
    },
  );

  it('asks the member to try again in the generic message', () => {
    expect(DEFAULT_SEARCH_ERROR).toBe('No pudimos buscar a los miembros. Inténtalo de nuevo.');
  });
});

describe('membersFound', () => {
  it('uses the singular for one member', () => {
    expect(membersFound(1)).toBe('1 miembro');
  });

  it.each([2, 50])('uses the plural for %i members', (count) => {
    expect(membersFound(count)).toBe(`${count} miembros`);
  });
});

describe('resultsLimited', () => {
  it('says how many results are shown and how to narrow the search', () => {
    expect(resultsLimited(50)).toBe(
      'Mostramos solo los primeros 50 resultados. Escribe más del nombre o del correo para afinar la búsqueda.',
    );
  });
});

describe('the payment lines', () => {
  it('writes the date of a payment without shifting its day', () => {
    // Read as an instant in Lima, 1 March at UTC midnight would be 28 February.
    expect(paidUntilText('2026-03-01')).toBe('Pagado hasta 1 de marzo de 2026');
    expect(lastDueText('2026-03-01')).toBe('Último vencimiento: 1 de marzo de 2026');
  });

  // The date comes from the server. A value that is no calendar day must not
  // throw while a screen renders: it gets a neutral line, and the screen lives.
  it.each([
    ['words', 'not-a-date'],
    ['an impossible day', '2026-02-30'],
    ['an instant', '2026-10-31T00:00:00Z'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
  ])('writes a neutral line, and does not throw, for a payment date that is %s', (_label, value) => {
    expect(paidUntilText(value)).toBe(PAYMENT_DATE_UNAVAILABLE);
    expect(lastDueText(value)).toBe(PAYMENT_DATE_UNAVAILABLE);
  });

  it('keeps the neutral line free of the value the server sent', () => {
    expect(paidUntilText('ana@example.test')).toBe('Fecha de pago no disponible');
  });
});

describe('periodFieldMessage', () => {
  it.each([
    ['startsOn', 'required', 'Indica la fecha de inicio.'],
    ['startsOn', 'invalid', 'La fecha de inicio no es válida.'],
    ['endsOn', 'required', 'Indica la fecha de fin.'],
    ['endsOn', 'invalid', 'La fecha de fin no es válida.'],
    ['endsOn', 'before_start', 'La fecha de fin no puede ser anterior a la de inicio.'],
  ])('says what is wrong with %s when it is %s', (field, problem, expected) => {
    expect(periodFieldMessage(field, problem)).toBe(expected);
  });

  it('has a message for every problem the validation can find', () => {
    const problems = [
      validatePeriod({ startsOn: '', endsOn: '' }),
      validatePeriod({ startsOn: 'junk', endsOn: 'junk' }),
      validatePeriod({ startsOn: '2026-10-20', endsOn: '2026-10-19' }),
    ].flatMap(({ errors }) => Object.entries(errors));

    expect(problems.length).toBeGreaterThanOrEqual(5);
    problems.forEach(([field, problem]) => {
      expect(periodFieldMessage(field, problem)).toEqual(expect.any(String));
    });
  });

  it.each([
    ['startsOn', 'before_start'],
    ['endsOn', 'constructor'],
    ['constructor', 'required'],
    ['endsOn', undefined],
  ])('has no message for %s / %s, which the validation never gives', (field, problem) => {
    expect(periodFieldMessage(field, problem)).toBeUndefined();
  });
});

describe('savePeriodErrorMessage', () => {
  it('names the date order and the five-year limit when the dates are refused', () => {
    expect(savePeriodErrorMessage(RESULT_CODES.INVALID)).toBe(
      'Revisa las fechas: el fin no puede ser anterior al inicio y un pago no puede durar más de 5 años.',
    );
  });

  it('says the dates overlap another payment of the member', () => {
    expect(savePeriodErrorMessage(RESULT_CODES.OVERLAP)).toBe(
      'Esas fechas se cruzan con otro pago de este miembro. Cambia las fechas e inténtalo de nuevo.',
    );
  });

  it('says the payment is gone when it no longer exists', () => {
    expect(savePeriodErrorMessage(RESULT_CODES.NOT_FOUND))
      .toBe('Este pago ya no existe. Mostramos la lista al día.');
  });

  it('asks for a new sign-in when the request is refused', () => {
    expect(savePeriodErrorMessage(RESULT_CODES.FORBIDDEN))
      .toBe('No tienes permiso para guardar este pago o tu sesión venció. Vuelve a ingresar.');
  });

  it('tells a lost connection apart', () => {
    expect(savePeriodErrorMessage(RESULT_CODES.NETWORK))
      .toBe('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  });

  it.each(
    Object.values(RESULT_CODES).filter((code) => ![
      RESULT_CODES.INVALID,
      RESULT_CODES.OVERLAP,
      RESULT_CODES.NOT_FOUND,
      RESULT_CODES.FORBIDDEN,
      RESULT_CODES.NETWORK,
    ].includes(code)),
  )('gives the code %s the generic message', (code) => {
    expect(savePeriodErrorMessage(code)).toBe(DEFAULT_SAVE_PERIOD_ERROR);
  });

  it.each(['constructor', 'toString', '', undefined, null, 42])(
    'gives the generic message to %j, which is no code at all',
    (code) => {
      expect(savePeriodErrorMessage(code)).toBe(DEFAULT_SAVE_PERIOD_ERROR);
    },
  );

  it('asks the administrator to try again in the generic message', () => {
    expect(DEFAULT_SAVE_PERIOD_ERROR).toBe('No pudimos guardar el pago. Inténtalo de nuevo.');
  });
});

describe('deletePeriodErrorMessage', () => {
  it('says the payment is gone when it no longer exists', () => {
    expect(deletePeriodErrorMessage(RESULT_CODES.NOT_FOUND))
      .toBe('Este pago ya no existe. Mostramos la lista al día.');
  });

  it('asks for a new sign-in when the request is refused', () => {
    expect(deletePeriodErrorMessage(RESULT_CODES.FORBIDDEN))
      .toBe('No tienes permiso para eliminar este pago o tu sesión venció. Vuelve a ingresar.');
  });

  it('tells a lost connection apart', () => {
    expect(deletePeriodErrorMessage(RESULT_CODES.NETWORK))
      .toBe('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  });

  it.each(
    Object.values(RESULT_CODES).filter((code) => ![
      RESULT_CODES.NOT_FOUND,
      RESULT_CODES.FORBIDDEN,
      RESULT_CODES.NETWORK,
    ].includes(code)),
  )('gives the code %s the generic message', (code) => {
    expect(deletePeriodErrorMessage(code)).toBe(DEFAULT_DELETE_PERIOD_ERROR);
  });

  it.each(['constructor', 'toString', '', undefined, null, 42])(
    'gives the generic message to %j, which is no code at all',
    (code) => {
      expect(deletePeriodErrorMessage(code)).toBe(DEFAULT_DELETE_PERIOD_ERROR);
    },
  );

  it('asks the administrator to try again in the generic message', () => {
    expect(DEFAULT_DELETE_PERIOD_ERROR).toBe('No pudimos eliminar el pago. Inténtalo de nuevo.');
  });
});

describe('the dates of a payment', () => {
  it('writes the two days it covers, without shifting either', () => {
    expect(periodRangeText('2026-10-01', '2026-10-31'))
      .toBe('Del 1 de octubre de 2026 al 31 de octubre de 2026');
    expect(periodRangeText('2026-03-01', '2026-03-01'))
      .toBe('Del 1 de marzo de 2026 al 1 de marzo de 2026');
  });

  it.each([
    ['the start is no calendar day', 'zzz', '2026-10-31'],
    ['the end is no calendar day', '2026-10-01', '2026-02-30'],
    ['both are missing', undefined, null],
    ['they are instants', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z'],
  ])('writes a neutral line, and does not throw, when %s', (_label, startsOn, endsOn) => {
    expect(periodRangeText(startsOn, endsOn)).toBe(PERIOD_DATES_UNAVAILABLE);
    expect(PERIOD_DATES_UNAVAILABLE).toBe('Fechas del pago no disponibles');
  });

  it('names the buttons of a payment after its dates, starting with what they do', () => {
    const range = periodRangeText('2026-10-01', '2026-10-31');

    expect(editPeriodLabel(range))
      .toBe('Editar el pago: Del 1 de octubre de 2026 al 31 de octubre de 2026');
    expect(deletePeriodLabel(range))
      .toBe('Eliminar el pago: Del 1 de octubre de 2026 al 31 de octubre de 2026');
  });
});

describe('paymentLine', () => {
  it('says an active member is paid until the date their payments run to', () => {
    expect(paymentLine({ isActive: true, paidUntil: '2026-10-31' }))
      .toBe('Pagado hasta 31 de octubre de 2026');
  });

  it('gives a member who is not active the last due date, which may lie in the future', () => {
    expect(paymentLine({ isActive: false, paidUntil: '2026-08-15' }))
      .toBe('Último vencimiento: 15 de agosto de 2026');
    expect(paymentLine({ isActive: false, paidUntil: '2026-12-31' }))
      .toBe('Último vencimiento: 31 de diciembre de 2026');
  });

  it.each([null, undefined, ''])('says there are no payments when the date is %j', (paidUntil) => {
    expect(paymentLine({ isActive: false, paidUntil })).toBe('Sin pagos registrados');
    expect(paymentLine({ isActive: true, paidUntil })).toBe('Sin pagos registrados');
  });

  it.each(['not-a-date', '2026-02-30', '2026-10-31T00:00:00Z'])(
    'writes the neutral line for %s, whatever the status',
    (paidUntil) => {
      expect(paymentLine({ isActive: true, paidUntil })).toBe(PAYMENT_DATE_UNAVAILABLE);
      expect(paymentLine({ isActive: false, paidUntil })).toBe(PAYMENT_DATE_UNAVAILABLE);
    },
  );
});

describe('the page of one member', () => {
  it('names the page and the way back to the directory', () => {
    expect(MEMBER_TITLE).toBe('Miembro');
    expect(BACK_TO_MEMBERS).toBe('Volver a miembros');
  });

  it('says what it is waiting for, and offers to try again', () => {
    expect(LOADING_MEMBER).toBe('Cargando al miembro…');
    expect(RETRY).toBe('Reintentar');
  });

  it('says plainly that the member is not there', () => {
    expect(MEMBER_NOT_FOUND_TITLE).toBe('Miembro no encontrado');
    expect(MEMBER_NOT_FOUND).toBe('No encontramos a este miembro.');
  });
});

describe('memberErrorMessage', () => {
  it('tells a lost connection apart', () => {
    expect(memberErrorMessage(RESULT_CODES.NETWORK))
      .toBe('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  });

  it('tells a refused request apart, and asks for a new sign-in', () => {
    expect(memberErrorMessage(RESULT_CODES.FORBIDDEN))
      .toBe('No tienes permiso para ver a este miembro o tu sesión venció. Vuelve a ingresar.');
  });

  it.each(
    Object.values(RESULT_CODES).filter(
      (code) => ![RESULT_CODES.NETWORK, RESULT_CODES.FORBIDDEN].includes(code),
    ),
  )('gives the code %s the generic message', (code) => {
    expect(memberErrorMessage(code)).toBe(DEFAULT_MEMBER_ERROR);
  });

  it.each(['constructor', 'toString', '', undefined, null, 42])(
    'gives the generic message to %j, which is no code at all',
    (code) => {
      expect(memberErrorMessage(code)).toBe(DEFAULT_MEMBER_ERROR);
    },
  );

  it('asks the administrator to try again in the generic message', () => {
    expect(DEFAULT_MEMBER_ERROR).toBe('No pudimos cargar al miembro. Inténtalo de nuevo.');
  });
});

describe('the keep-alive notice', () => {
  const RUNS = 'Revisa el historial del flujo «Keep-alive ping» en GitHub Actions.';

  it('has no message for a project that has no ping recorded', () => {
    expect(copy).not.toHaveProperty('KEEPALIVE_NEVER');
  });

  it('gives the day of the last ping and how many days ago it was', () => {
    expect(keepaliveStaleText(new Date('2026-10-16T17:00:00Z'), 4)).toBe(
      `El último ping de mantenimiento registrado fue el 16 de octubre de 2026, hace 4 días. ${RUNS}`,
    );
  });

  it('uses the singular for one day', () => {
    expect(keepaliveStaleText(new Date('2026-10-19T17:00:00Z'), 1)).toBe(
      `El último ping de mantenimiento registrado fue el 19 de octubre de 2026, hace 1 día. ${RUNS}`,
    );
  });

  // The ping is an instant, so the day it falls on depends on the zone: the notice
  // writes it on the Lima calendar (UTC-05:00), like the account page does.
  it('writes the day of the ping on the Lima calendar, not on the UTC one', () => {
    expect(keepaliveStaleText(new Date('2026-10-17T04:59:59Z'), 3))
      .toContain('fue el 16 de octubre de 2026, ');
    expect(keepaliveStaleText(new Date('2026-10-17T05:00:00Z'), 3))
      .toContain('fue el 17 de octubre de 2026, ');
  });

  // `last_ping_at` can be refreshed by anyone holding the publishable key, and the
  // run history is the real signal, so the notice only reports what is recorded.
  it('never says that the workflow failed', () => {
    expect(keepaliveStaleText(new Date('2026-10-16T17:00:00Z'), 4))
      .not.toMatch(/fall|error|caíd|roto|no funciona/i);
  });
});
