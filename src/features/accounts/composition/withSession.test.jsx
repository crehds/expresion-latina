import PropTypes from 'prop-types';
import { render, screen } from '@testing-library/react';
import BackendContext from '../../../shared/backend/BackendContext';
import { hasStoredSession } from '../../../shared/backend/client';
import { SessionProvider } from './SessionProvider';
import withSession from './withSession';

vi.mock('../../../shared/backend/client', async (importOriginal) => ({
  ...(await importOriginal()),
  hasStoredSession: vi.fn(() => false),
}));

function Greeting({ session, label }) {
  return <p data-testid="out">{`${label}:${session.status}`}</p>;
}

Greeting.propTypes = {
  session: PropTypes.shape({ status: PropTypes.string.isRequired }).isRequired,
  label: PropTypes.string.isRequired,
};

const Wrapped = withSession(Greeting);

describe('withSession', () => {
  it('injects the session context as the session prop and keeps the other props', () => {
    const auth = { getSession: vi.fn() };
    render(
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider><Wrapped label="menu" /></SessionProvider>
      </BackendContext.Provider>,
    );

    expect(screen.getByTestId('out').textContent).toBe('menu:idle');
    expect(hasStoredSession).toHaveBeenCalled();
  });

  it('injects a disabled session without a provider', () => {
    render(<Wrapped label="menu" />);

    expect(screen.getByTestId('out').textContent).toBe('menu:disabled');
  });
});
