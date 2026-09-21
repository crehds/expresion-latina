import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

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

// Everything else here uses MemoryRouter, which cannot catch a wrong base
// path. This renders the production configuration: a real BrowserRouter
// reading PUBLIC_URL, which is what a blank deployed page comes down to.
describe('App mounted the way it is deployed', () => {
  it('matches a route at the site root', async () => {
    render(
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>,
    );

    // findAll, not find: the carousel wraps around, so it clones its slides.
    const posters = await screen.findAllByRole('img', { name: 'Casting de la academia' });

    expect(posters.length).toBeGreaterThan(0);
  });
});

describe('App', () => {
  it('renders every navigation entry', async () => {
    await renderAt('/contact');

    [
      'Inicio',
      'Profesores',
      'Clases',
      'Horario',
      'Encuéntranos',
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Opinions are a section of the landing page, not somewhere to navigate
    // to, so the menu must not offer them.
    expect(screen.queryByText('Reseñas')).not.toBeInTheDocument();
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
