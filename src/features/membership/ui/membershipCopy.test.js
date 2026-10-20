import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { validatePeriod } from '../domain/periodValidation';
import {
  DEFAULT_DELETE_PERIOD_ERROR,
  DEFAULT_SAVE_PERIOD_ERROR,
  DEFAULT_SEARCH_ERROR,
  PAYMENT_DATE_UNAVAILABLE,
  PERIOD_DATES_UNAVAILABLE,
  deletePeriodErrorMessage,
  deletePeriodLabel,
  editPeriodLabel,
  lastDueText,
  membersFound,
  paidUntilText,
  periodFieldMessage,
  periodRangeText,
  resultsLimited,
  savePeriodErrorMessage,
  searchErrorMessage,
} from './membershipCopy';

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
