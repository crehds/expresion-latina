import { render, screen } from '@testing-library/react';

/*
 * The footer is on every page, and every field it shows but the studio name is
 * nullable in the schema. A studio published without a WhatsApp number should
 * lose that one line; it should not take the bottom of all five routes with
 * it. That is the same contract that broke the Hero once, which is why both
 * halves of it are pinned here rather than left to the happy path.
 *
 * Each case mocks the data module and imports the component after it, because
 * the module reads the studio once, at import.
 */
async function renderFooter(data) {
  vi.resetModules();
  vi.doMock('../../data', () => data);

  const { default: Footer } = await import('./Footer');
  return render(<Footer />);
}

const FULL = {
  studio: {
    name: 'Expresión Latina',
    address: 'Av. Palmeras 3839',
    city: 'Lima',
    country: 'Perú',
    email: 'hola@ejemplo.com',
    whatsapp: '+51 960 507 583',
    social: { facebook: 'https://facebook.com/x', instagram: 'https://instagram.com/x' },
  },
  whatsappLink: 'https://wa.me/51960507583',
};

const EMPTY = {
  studio: {
    name: 'Expresión Latina',
    address: null,
    city: null,
    country: null,
    email: null,
    whatsapp: null,
    social: {},
  },
  whatsappLink: null,
};

afterEach(() => vi.doUnmock('../../data'));

describe('a studio with its details published', () => {
  beforeEach(() => renderFooter(FULL));

  it('offers the number as something to tap, not to copy out', () => {
    expect(screen.getByRole('link', { name: /960 507 583/ }))
      .toHaveAttribute('href', 'https://wa.me/51960507583');
  });

  it('sends the address to a map rather than printing it', () => {
    expect(screen.getByRole('link', { name: /Av\. Palmeras/ }))
      .toHaveAttribute('href', expect.stringContaining('google.com/maps'));
  });

  it('keeps the social links it always had', () => {
    expect(screen.getByRole('link', { name: /Facebook/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Instagram/ })).toBeInTheDocument();
  });
});

describe('a studio with no contact details', () => {
  beforeEach(() => renderFooter(EMPTY));

  it('still renders its name', () => {
    expect(screen.getByText('Expresión Latina')).toBeInTheDocument();
  });

  it('shows no links at all rather than links to nowhere', () => {
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
