import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import {
  DEFAULT_SEARCH_ERROR,
  lastDueText,
  membersFound,
  paidUntilText,
  resultsLimited,
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
});
