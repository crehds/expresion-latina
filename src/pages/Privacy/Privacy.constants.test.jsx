import { render, screen, within } from '@testing-library/react';
import Privacy from './Privacy';

// Figures nobody would write by hand, with the singular on two of them, so the
// page can only show them if it reads them from these two modules: the version
// from the notice version, every term from the retention terms.
vi.mock('../../features/accounts/domain/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2031-07-09',
}));
vi.mock('../../features/accounts/domain/retentionTerms', () => ({
  PENDING_CONSENT_DELETED_WITHIN_HOURS: 1,
  UNCONFIRMED_EMAIL_DAYS: 22,
  DORMANT_ACCOUNT_YEARS: 3,
  ATTENDANCE_CONFIRMATION_DAYS: 1,
}));

vi.mock('../../features/accounts/domain/privacyContacts', () => ({
  CONTROLLER: 'Academia de Prueba S.A.C. (RUC 20000000001)',
  CONTACT: 'privacidad@prueba.test',
}));

const retentionItems = () => within(
  screen.getByRole('heading', { level: 2, name: 'Cuánto tiempo los conservamos' }).closest('section'),
).getAllByRole('listitem').map((item) => item.textContent);

describe('Privacy, rendered from its constants modules', () => {
  it('shows the notice version of the notice version module', () => {
    render(<Privacy />);

    expect(screen.getByText('Versión 2031-07-09')).toBeInTheDocument();
    expect(screen.queryByText(/2026-01-01/)).not.toBeInTheDocument();
  });

  it('shows every retention term with the figure of the retention terms module', () => {
    render(<Privacy />);

    const items = retentionItems();

    expect(items[0]).toMatch(/en un plazo máximo de 1 hora desde su creación/);
    expect(items[1]).toMatch(/después de 22 días/);
    expect(items[2]).toMatch(/Después de 3 años/);
    expect(items[3]).toMatch(/1 día después de la fecha de la clase/);
  });

  it('names the controller and the contact of the privacy contacts module', () => {
    render(<Privacy />);

    const text = screen.getByRole('main').textContent;

    expect(text).toContain('Responsable de tus datos: Academia de Prueba S.A.C. (RUC 20000000001).');
    expect(text).toContain('Contacto: privacidad@prueba.test.');
    expect(text).toContain('escribe a privacidad@prueba.test.');
    expect(text).not.toMatch(/\[RESPONSABLE\]|\[CONTACTO\]/);
  });

  it('writes the singular and the plural right: never "1 horas" or "1 días"', () => {
    render(<Privacy />);

    expect(screen.getByRole('main').textContent).not.toMatch(/\b1 (horas|días|años)/);
  });

  it('does not leave a real figure written by hand anywhere on the page', () => {
    render(<Privacy />);

    expect(screen.getByRole('main').textContent).not.toMatch(/24 horas|\b7 días|\b2 años|30 días/);
  });
});
