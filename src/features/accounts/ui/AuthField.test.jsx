import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthField from './AuthField';

const noop = () => {};

describe('AuthField', () => {
  it('is a text input named by its label, with the attributes it is given', () => {
    render(
      <AuthField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={40}
        value=""
        onChange={noop}
      />,
    );

    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('maxlength', '40');
    expect(input).toBeRequired();
    expect(input).toBeValid();
    expect(input).not.toHaveAccessibleDescription();
  });

  it('is a text field unless another type is asked for', () => {
    render(<AuthField label="Correo" name="email" value="" onChange={noop} />);

    expect(screen.getByRole('textbox', { name: 'Correo' })).toBeInTheDocument();
  });

  it('shows the value it is given', () => {
    render(<AuthField label="Correo" name="email" value="ana@example.test" onChange={noop} />);

    expect(screen.getByLabelText('Correo')).toHaveValue('ana@example.test');
  });

  it('hands the typed text, not the event, to onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AuthField label="Correo" name="email" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Correo'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('describes the field with its hint', () => {
    render(
      <AuthField label="Correo" name="email" value="" onChange={noop} hint="Mínimo 8 caracteres." />,
    );

    expect(screen.getByLabelText('Correo')).toHaveAccessibleDescription('Mínimo 8 caracteres.');
    expect(screen.getByLabelText('Correo')).toBeValid();
  });

  it('marks the field invalid and describes it with the error', () => {
    render(
      <AuthField
        label="Correo"
        name="email"
        value=""
        onChange={noop}
        error="Escribe un correo válido."
      />,
    );

    const input = screen.getByLabelText('Correo');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Escribe un correo válido.');
  });

  it('describes the field with the hint and the error together', () => {
    render(
      <AuthField
        label="Correo"
        name="email"
        value=""
        onChange={noop}
        hint="Mínimo 8 caracteres."
        error="La contraseña es muy corta."
      />,
    );

    expect(screen.getByLabelText('Correo'))
      .toHaveAccessibleDescription('Mínimo 8 caracteres. La contraseña es muy corta.');
  });

  it('gives the input to the ref, so a form can move the focus to it', () => {
    const inputRef = createRef();
    render(<AuthField label="Correo" name="email" value="" onChange={noop} inputRef={inputRef} />);

    inputRef.current.focus();

    expect(screen.getByLabelText('Correo')).toHaveFocus();
  });

  it('gives two fields their own ids', () => {
    render(
      <>
        <AuthField label="Uno" name="one" value="" onChange={noop} error="Primero" />
        <AuthField label="Dos" name="two" value="" onChange={noop} error="Segundo" />
      </>,
    );

    expect(screen.getByLabelText('Uno')).toHaveAccessibleDescription('Primero');
    expect(screen.getByLabelText('Dos')).toHaveAccessibleDescription('Segundo');
  });
});
