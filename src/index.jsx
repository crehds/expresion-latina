import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import createServices from './composition/createServices';
import { SessionProvider } from './features/accounts/composition/SessionProvider';
import { BackendProvider } from './shared/backend/BackendContext';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <BackendProvider createServices={createServices}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BackendProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// A service worker was deployed to GitHub Pages by an earlier build, so
// returning visitors can still be holding one that serves a stale cached site.
// getRegistrations() clears those; navigator.serviceWorker.ready never resolves
// when none is registered, which is why it is not used here.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}
