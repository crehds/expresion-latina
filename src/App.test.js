import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './App';

// Every page is behind React.lazy, so rendering is not finished until the
// route's chunk has resolved. Waiting here keeps that resolution inside the
// test rather than letting it land after the assertions.
async function renderAt(path) {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

  // Well above the 1s default: jest transforms every image and video the data
  // layer registers before this chunk resolves, which takes about 1.2s here.
  await screen.findByRole('button', { name: /Mapa/ }, { timeout: 5000 });

  return result;
}

describe('App', () => {
  it('renders every navigation entry', async () => {
    await renderAt('/contact');

    [
      'Inicio',
      'Profesores',
      'Clases',
      'Horario',
      'Reseñas',
      'Encuéntranos',
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('marks the entry for the current route as active', async () => {
    await renderAt('/contact');

    expect(screen.getByText('Encuéntranos')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Inicio')).not.toHaveAttribute('aria-current');
  });

  // Proves the Suspense boundary and the route's chunk resolve rather than
  // leaving the loader on screen forever.
  it('resolves the lazy chunk for a route', async () => {
    await renderAt('/contact');

    expect(screen.getByRole('button', { name: /Info/ })).toBeInTheDocument();
  });
});
