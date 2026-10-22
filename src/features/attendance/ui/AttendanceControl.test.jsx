import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import userEvent from '@testing-library/user-event';

import AttendanceControl from './AttendanceControl';

const WHATSAPP = 'https://wa.me/51960507583';

function renderControl(props = {}) {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() };
  const view = render(createElement(AttendanceControl, {
    state: 'confirm',
    classDate: '2026-10-26',
    coveredThrough: '2026-10-31',
    whatsappLink: WHATSAPP,
    ...handlers,
    ...props,
  }));
  return { ...view, ...handlers };
}

describe('AttendanceControl', () => {
  describe('state confirm', () => {
    it('offers to confirm and names the class date', () => {
      renderControl({ state: 'confirm' });

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeEnabled();
      expect(screen.getByText('Próxima clase: 26 de octubre de 2026')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar asistencia' })).toBeNull();
    });

    // A light round toggle instead of a pill: an outline with a calendar when the
    // class is not confirmed yet. Its name is the action, so it has no visible text.
    it('is a round toggle with a calendar icon, not pressed, named by its label', () => {
      const { container } = renderControl({ state: 'confirm' });

      const toggle = screen.getByRole('button', { name: 'Confirmar asistencia' });
      expect(toggle).toHaveAttribute('aria-label', 'Confirmar asistencia');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).toHaveClass('attendance-control__toggle');
      expect(toggle).toHaveTextContent('');
      const icon = toggle.querySelector('.icon-calendar');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(toggle.querySelector('svg')).toBeNull();
      expect(container.querySelector('[style]')).toBeNull();
    });

    it('has no caption: the class is not confirmed yet', () => {
      renderControl({ state: 'confirm' });

      expect(screen.queryByText('Vas a esta clase')).toBeNull();
    });

    it('describes the button with the date, so the buttons of several cards differ', () => {
      renderControl({ state: 'confirm' });

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' }))
        .toHaveAccessibleDescription('Próxima clase: 26 de octubre de 2026');
    });

    it('confirms on a click', async () => {
      const { onConfirm, onCancel } = renderControl({ state: 'confirm' });

      await userEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('is disabled and busy while the action is in flight', async () => {
      const { onConfirm } = renderControl({ state: 'confirm', busy: true });

      const button = screen.getByRole('button', { name: 'Confirmar asistencia' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      await userEvent.click(button);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('leaves out the date line when the date cannot be written', () => {
      renderControl({ state: 'confirm', classDate: 'soon' });

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeInTheDocument();
      expect(screen.queryByText(/Próxima clase/)).toBeNull();
    });
  });

  describe('state cancel', () => {
    it('says the member goes to the class and offers to cancel the attendance', () => {
      renderControl({ state: 'cancel' });

      expect(screen.getByText('Vas a esta clase')).toBeInTheDocument();
      expect(screen.getByText('Próxima clase: 26 de octubre de 2026')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Confirmar asistencia' })).toBeNull();
      expect(screen.queryByText(/Confirmaste/)).toBeNull();
    });

    // Filled, with a check drawn inline (the icon font has no check), and pressed.
    it('is a pressed round toggle with an inline check, hidden from assistive technology', () => {
      const { container } = renderControl({ state: 'cancel' });

      const toggle = screen.getByRole('button', { name: 'Cancelar asistencia' });
      expect(toggle).toHaveAttribute('aria-label', 'Cancelar asistencia');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveClass('attendance-control__toggle');
      expect(toggle).toHaveTextContent('');
      const check = toggle.querySelector('svg');
      expect(check).toBeInTheDocument();
      expect(check).toHaveAttribute('aria-hidden', 'true');
      expect(check).toHaveAttribute('focusable', 'false');
      expect(toggle.querySelector('.icon-calendar')).toBeNull();
      expect(container.querySelector('[style]')).toBeNull();
    });

    it('describes the button with the date, like the confirm one', () => {
      renderControl({ state: 'cancel' });

      expect(screen.getByRole('button', { name: 'Cancelar asistencia' }))
        .toHaveAccessibleDescription('Próxima clase: 26 de octubre de 2026');
    });

    it('cancels on a click, and not while busy', async () => {
      const { onCancel, rerender } = renderControl({ state: 'cancel' });

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar asistencia' }));
      expect(onCancel).toHaveBeenCalledTimes(1);

      rerender(
        <AttendanceControl
          state="cancel"
          classDate="2026-10-26"
          whatsappLink={WHATSAPP}
          busy
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );
      const toggle = screen.getByRole('button', { name: 'Cancelar asistencia' });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('aria-busy', 'true');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // The message about an inactive membership is said once, above the schedule
  // (InactiveMembershipNotice), and no longer on every card.
  describe('state inactive', () => {
    it('says nothing of its own: no message, no link and no button', () => {
      const { container } = renderControl({ state: 'inactive' });

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText(/Tu membresía/)).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
    });
  });

  describe('state uncovered', () => {
    it('says the day the membership runs to, with the link and no button', () => {
      renderControl({ state: 'uncovered', coveredThrough: '2026-10-31' });

      expect(screen.getByText('Tu membresía vence el 31 de octubre de 2026.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveAttribute('href', WHATSAPP);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the message alone when there is no WhatsApp link', () => {
      const { container } = renderControl({ state: 'uncovered', whatsappLink: null });

      expect(screen.getByText(/Tu membresía vence el/)).toBeInTheDocument();
      expect(container.querySelector('a')).toBeNull();
    });

    it('uses the neutral line when the last day is unknown', () => {
      renderControl({ state: 'uncovered', coveredThrough: null });

      expect(screen.getByText('Tu membresía no cubre esta clase.')).toBeInTheDocument();
    });
  });

  describe('an error', () => {
    it('is announced as an alert with the message of its code', () => {
      renderControl({ state: 'confirm', errorCode: 'FORBIDDEN' });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'No pudimos confirmar tu asistencia. Revisa que tu membresía cubra esa fecha.',
      );
    });

    it('says a class has started', () => {
      renderControl({ state: 'confirm', errorCode: 'STARTED' });

      expect(screen.getByRole('alert')).toHaveTextContent('Esta clase ya empezó.');
    });

    // The data may have just changed under the member: a refusal can sit on a card
    // the page has already moved to "inactive", and it still says which class failed.
    it('shows alone on an inactive card, since the data may have just changed', () => {
      renderControl({ state: 'inactive', errorCode: 'FORBIDDEN' });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'No pudimos confirmar tu asistencia. Revisa que tu membresía cubra esa fecha.',
      );
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('shows next to the toggle of a confirmed class too', () => {
      renderControl({ state: 'cancel', errorCode: 'NETWORK' });

      expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión.');
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeInTheDocument();
    });

    it('is absent without an error code', () => {
      renderControl({ state: 'confirm' });

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('shows the error alone for a state with no body, so a started class says so', () => {
    renderControl({ state: 'started', errorCode: 'STARTED' });

    expect(screen.getByRole('alert')).toHaveTextContent('Esta clase ya empezó.');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each(['hidden', 'started', 'inactive', 'nonsense', undefined])('renders nothing for the state %s', (state) => {
    const { container } = renderControl({ state });

    expect(container).toBeEmptyDOMElement();
  });

  // Only a class that started gets its error alone: any other state without a body
  // has no reason to speak.
  it.each(['hidden', 'nonsense', undefined])(
    'renders nothing for the state %s even with an error code',
    (state) => {
      const { container } = renderControl({ state, errorCode: 'STARTED' });

      expect(container).toBeEmptyDOMElement();
    },
  );
});
