import { render, screen } from '@testing-library/react';

/*
 * The contact page's WhatsApp row. It used to be gated on the raw studio cell
 * while its href came from the derived link, so a cell carrying no number —
 * a dash, a note, a stray space — rendered something that looks like a link
 * and is not one: no href, not focusable, not announced as a link, inert to
 * a tap.
 */
async function renderInfo(whatsapp, whatsappLink) {
  vi.resetModules();
  vi.doMock('../../../data', () => ({
    studio: {
      whatsapp, address: 'Av. Palmeras 3839', email: 'hola@ejemplo.com', social: {},
    },
    whatsappLink,
  }));

  const { default: Info } = await import('./Info');
  vi.doUnmock('../../../data');

  return render(<Info />);
}

describe('the contact details', () => {
  it('offers the number as a link when there is one', async () => {
    await renderInfo('+51 960 507 583', 'https://wa.me/51960507583');

    expect(screen.getByRole('link', { name: /960 507 583/ }))
      .toHaveAttribute('href', 'https://wa.me/51960507583');
  });

  it('shows no whatsapp row at all when the cell carries no number', async () => {
    await renderInfo('-', null);

    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('never renders an anchor without an href', async () => {
    await renderInfo('preguntar por WhatsApp', null);

    screen.queryAllByRole('link').forEach((link) => {
      expect(link).toHaveAttribute('href');
    });
  });

  it('keeps the rest of the details when there is no number', async () => {
    await renderInfo(null, null);

    expect(screen.getByText('Av. Palmeras 3839')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hola@ejemplo.com' })).toBeInTheDocument();
  });
});
