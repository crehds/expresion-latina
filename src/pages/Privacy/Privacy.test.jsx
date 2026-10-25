import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionContext from '../../features/accounts/composition/SessionProvider';
import { CURRENT_NOTICE_VERSION } from '../../features/accounts/domain/noticeVersion';
import BackendContext from '../../shared/backend/BackendContext';
import Privacy from './Privacy';

const SECTIONS = [
  'Quién es responsable',
  'Qué datos guardamos',
  'Para qué los usamos',
  'Quién puede verlos',
  'Dónde se guardan',
  'Cuánto tiempo los conservamos',
  'Tus derechos',
  'Cambios en este aviso',
];

// The page needs no provider at all, which is part of what these tests prove.
const renderPrivacy = () => render(<Privacy />);

// The part of the page under one level-2 heading.
const section = (name) => within(
  screen.getByRole('heading', { level: 2, name }).closest('section'),
);

// The text of the items of the list under one heading.
const itemsOf = (name) => section(name).getAllByRole('listitem').map((item) => item.textContent);

describe('Privacy', () => {
  describe('structure', () => {
    it('has one level-1 heading and the notice version right under the title', () => {
      renderPrivacy();

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }))
        .toBeInTheDocument();
      expect(screen.getByText(`Versión ${CURRENT_NOTICE_VERSION}`)).toBeInTheDocument();
    });

    it('is the main landmark of the page', () => {
      renderPrivacy();

      expect(screen.getByRole('main')).toContainElement(
        screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }),
      );
    });

    it('has one level-2 heading per section, in the order of the notice, and no deeper ones', () => {
      renderPrivacy();

      const headings = screen.getAllByRole('heading').filter((heading) => heading.tagName !== 'H1');

      expect(headings.map((heading) => heading.tagName)).toEqual(SECTIONS.map(() => 'H2'));
      expect(headings.map((heading) => heading.textContent)).toEqual(SECTIONS);
    });

    it('puts every section in a section element, under its own heading', () => {
      renderPrivacy();

      SECTIONS.forEach((name) => {
        const heading = screen.getByRole('heading', { level: 2, name });
        expect(heading.closest('section')).not.toBeNull();
        expect(heading.closest('section').querySelectorAll('h2')).toHaveLength(1);
      });
    });

    it('lists what is a list: every list item is in a real list', () => {
      const { container } = renderPrivacy();

      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThanOrEqual(5);
      container.querySelectorAll('li').forEach((item) => {
        expect(item.parentElement.tagName).toBe('UL');
      });
      ['Qué datos guardamos', 'Para qué los usamos', 'Quién puede verlos', 'Dónde se guardan', 'Cuánto tiempo los conservamos']
        .forEach((name) => {
          expect(section(name).getByRole('list')).toBeInTheDocument();
        });
    });
  });

  describe('who is responsible', () => {
    it('names the academy as the controller and its email as the contact, with no placeholder left', () => {
      renderPrivacy();

      expect(section('Quién es responsable').getByText('Responsable de tus datos: Expresión Latina S.A.C.'))
        .toBeVisible();
      expect(section('Quién es responsable').getByText('Contacto: expresionlatina@gmail.com.'))
        .toBeVisible();
      expect(screen.getByRole('main').textContent).not.toMatch(/\[RESPONSABLE\]|\[CONTACTO\]/);
    });
  });

  describe('the data kept', () => {
    it('lists the email and the hashed password, the name, the consent, Google, the paid periods and the confirmations', () => {
      renderPrivacy();

      const text = itemsOf('Qué datos guardamos').join('\n');

      expect(text).toMatch(/correo/);
      expect(text).toMatch(/contraseña/);
      expect(text).toMatch(/hash/);
      expect(text).toMatch(/nombre completo/);
      expect(text).toMatch(/consentimiento/);
      expect(text).toMatch(/versión de este aviso/);
      expect(text).toMatch(/Google/);
      expect(text).toMatch(/periodos pagados/);
      expect(text).toMatch(/confirmaciones de asistencia/);
    });

    it('says only a hash of the password is kept, not the password itself', () => {
      renderPrivacy();

      const [accountItem] = itemsOf('Qué datos guardamos');

      expect(accountItem).toMatch(/solo una versión protegida/);
      expect(accountItem).toMatch(/hash/);
      expect(accountItem).toMatch(/no la contraseña/);
    });

    it('names the sign-in and session dates the two-year rule looks at', () => {
      renderPrivacy();

      const text = itemsOf('Qué datos guardamos').join('\n');

      expect(text).toMatch(/fechas de tus ingresos/);
      expect(text).toMatch(/renovación de tu sesión/);
    });
  });

  describe('what the data is for', () => {
    it('lists the account, the payments and the membership, and the number of people in each class', () => {
      renderPrivacy();

      const text = itemsOf('Para qué los usamos').join('\n');

      expect(text).toMatch(/cuenta/);
      expect(text).toMatch(/pagos/);
      expect(text).toMatch(/membresía/);
      expect(text).toMatch(/cuántas personas asisten a cada clase/);
    });
  });

  describe('who can see the data', () => {
    it('says the member sees their own, and the administrators the directory, the periods and the attendee lists', () => {
      renderPrivacy();

      const text = itemsOf('Quién puede verlos').join('\n');

      expect(text).toMatch(/Tú ves tus propios datos/);
      expect(text).toMatch(/administradores de la academia/);
      expect(text).toMatch(/directorio de miembros/);
      expect(text).toMatch(/periodos pagados/);
      expect(text).toMatch(/listas de asistentes/);
    });

    it('says nobody else sees them and that the teachers have no access', () => {
      renderPrivacy();

      const text = itemsOf('Quién puede verlos').join('\n');

      expect(text).toMatch(/Ninguna otra persona que use el sitio/);
      expect(text).toMatch(/profesores no tienen acceso/);
    });
  });

  describe('where the data is kept', () => {
    it('names Supabase in Northern Virginia, Vercel, Google and an email delivery service', () => {
      renderPrivacy();

      const items = itemsOf('Dónde se guardan');
      const text = items.join('\n');

      expect(text).toMatch(/Supabase/);
      // The hosted project's region is us-east-1 (owner, 2026-10-25).
      expect(text).toMatch(/Virginia del Norte \(Estados Unidos\)/);
      expect(text).not.toMatch(/São Paulo/);
      expect(text).toMatch(/Vercel/);
      expect(text).toMatch(/Google/);
      expect(text).toMatch(/servicio de envío de correo electrónico/);
      expect(items).toHaveLength(4);
    });
  });

  describe('how long the data is kept', () => {
    it('states the five terms, with the figures of the retention terms', () => {
      renderPrivacy();

      const items = itemsOf('Cuánto tiempo los conservamos');

      expect(items).toHaveLength(5);
      expect(items[0]).toMatch(/consentimiento/);
      expect(items[0]).toMatch(/24 horas/);
      expect(items[1]).toMatch(/correo/);
      expect(items[1]).toMatch(/7 días/);
      expect(items[2]).toMatch(/2 años/);
      expect(items[2]).toMatch(/ingreses/);
      expect(items[2]).toMatch(/renueves tu sesión/);
      expect(items[2]).toMatch(/pagos/);
      expect(items[3]).toMatch(/confirmaciones de asistencia/);
      expect(items[3]).toMatch(/30 días después de la fecha de la clase/);
      expect(items[4]).toMatch(/de inmediato/);
      expect(items[4]).toMatch(/pagos/);
      expect(items[4]).toMatch(/confirmaciones/);
    });
  });

  describe('the rights of the member', () => {
    it('names access, rectification, cancellation and opposition, and the contact to write to', () => {
      renderPrivacy();

      const text = section('Tus derechos').getByText(/acceso/).textContent;

      expect(text).toMatch(/acceso, rectificación, cancelación y oposición/);
      expect(text).toMatch(/escribe a expresionlatina@gmail\.com\./);
    });

    it('says the account can be deleted from "Mi cuenta", in plain text', () => {
      renderPrivacy();

      expect(section('Tus derechos').getByText(/«Mi cuenta»/)).toBeInTheDocument();
      expect(section('Tus derechos').queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('changes to the notice', () => {
    it('says the member accepts the new notice when signing in, and that declining deletes the account', () => {
      renderPrivacy();

      const text = section('Cambios en este aviso').getByText(/aceptes de nuevo/).textContent;

      expect(text).toMatch(/cuando ingreses/);
      expect(text).toMatch(/eliminaremos tu cuenta/);
    });
  });

  describe('the backend', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('is never asked for anything, and the session is not started', () => {
      const touched = [];
      const auth = new Proxy({}, {
        get: (_target, name) => {
          touched.push(String(name));
          return vi.fn();
        },
      });
      const session = {
        status: 'idle',
        session: null,
        profile: null,
        errorCode: null,
        start: vi.fn(),
        refresh: vi.fn(),
        signOut: vi.fn(),
      };
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(
        <MemoryRouter>
          <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
            <SessionContext.Provider value={session}>
              <Privacy />
            </SessionContext.Provider>
          </BackendContext.Provider>
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }))
        .toBeInTheDocument();
      expect(touched).toEqual([]);
      expect(session.start).not.toHaveBeenCalled();
      expect(session.refresh).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
