import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ConsentCheckbox from './ConsentCheckbox';

const NAME = 'Leí y acepto el Aviso de privacidad';

function renderCheckbox({ checked = false, onChange = vi.fn() } = {}) {
  const view = render(
    <MemoryRouter>
      <ConsentCheckbox checked={checked} onChange={onChange} />
    </MemoryRouter>,
  );
  return { onChange, ...view };
}

describe('ConsentCheckbox', () => {
  it('is an unchecked checkbox named after the privacy notice', () => {
    renderCheckbox();

    expect(screen.getByRole('checkbox', { name: NAME })).not.toBeChecked();
  });

  it('shows the state it is given', () => {
    renderCheckbox({ checked: true });

    expect(screen.getByRole('checkbox', { name: NAME })).toBeChecked();
  });

  it('reports the new state when the box is toggled', async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = renderCheckbox();

    await user.click(screen.getByRole('checkbox', { name: NAME }));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(
      <MemoryRouter>
        <ConsentCheckbox checked onChange={onChange} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('checkbox', { name: NAME }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('is toggled by its text as well', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCheckbox();

    await user.click(screen.getByText(/Leí y acepto el/));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('links the words "Aviso de privacidad" to /privacy, in a new tab so the form keeps its data', () => {
    renderCheckbox();

    const link = screen.getByRole('link', { name: 'Aviso de privacidad' });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
  });

  it('does not toggle the box when the notice link is used', () => {
    const { onChange } = renderCheckbox();
    const link = screen.getByRole('link', { name: 'Aviso de privacidad' });
    link.addEventListener('click', (event) => event.preventDefault());

    fireEvent.click(link);

    expect(onChange).not.toHaveBeenCalled();
  });
});
