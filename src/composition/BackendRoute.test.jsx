import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BackendContext from '../shared/backend/BackendContext';
import BackendRoute from './BackendRoute';

function renderRoute(value) {
  const tree = (
    <MemoryRouter>
      <Suspense fallback={null}>
        <BackendRoute><h1>feature page</h1></BackendRoute>
      </Suspense>
    </MemoryRouter>
  );
  return render(value
    ? <BackendContext.Provider value={value}>{tree}</BackendContext.Provider>
    : tree);
}

describe('BackendRoute', () => {
  it('renders the not-found page without a provider, where the backend is off by default', async () => {
    renderRoute();

    expect(await screen.findByRole('heading', { level: 1, name: /no encontramos/i }))
      .toBeInTheDocument();
    expect(screen.queryByText('feature page')).not.toBeInTheDocument();
  });

  it('renders the not-found page while the backend is disabled', async () => {
    renderRoute({ enabled: false, services: null });

    expect(await screen.findByRole('heading', { level: 1, name: /no encontramos/i }))
      .toBeInTheDocument();
    expect(screen.queryByText('feature page')).not.toBeInTheDocument();
  });

  it('renders its page while the backend is enabled', () => {
    renderRoute({ enabled: true, services: {} });

    expect(screen.getByRole('heading', { level: 1, name: 'feature page' })).toBeInTheDocument();
    expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
  });
});
