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
    it('says the attendance is confirmed and offers to cancel it', () => {
      renderControl({ state: 'cancel' });

      expect(screen.getByText('Confirmaste tu asistencia.')).toBeInTheDocument();
      expect(screen.getByText('Próxima clase: 26 de octubre de 2026')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Confirmar asistencia' })).toBeNull();
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
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeDisabled();
    });
  });

  describe('state inactive', () => {
    it('says the membership is not active and links to WhatsApp, with no button', () => {
      renderControl({ state: 'inactive' });

      expect(screen.getByText('Tu membresía no está activa.')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Escríbenos por WhatsApp' });
      expect(link).toHaveAttribute('href', WHATSAPP);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the message alone when there is no WhatsApp link', () => {
      const { container } = renderControl({ state: 'inactive', whatsappLink: null });

      expect(screen.getByText('Tu membresía no está activa.')).toBeInTheDocument();
      expect(container.querySelector('a')).toBeNull();
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

    it('shows next to the inactive message too, since the data may have just changed', () => {
      renderControl({ state: 'inactive', errorCode: 'FORBIDDEN' });

      expect(screen.getByText('Tu membresía no está activa.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('is absent without an error code', () => {
      renderControl({ state: 'confirm' });

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it.each(['hidden', 'started', 'nonsense', undefined])('renders nothing for the state %s', (state) => {
    const { container } = renderControl({ state });

    expect(container).toBeEmptyDOMElement();
  });
});
