import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

import { Footer, Header } from './components';
import Loader from './components/Loader/Loader';
import AdminRoute from './composition/AdminRoute';
import BackendRoute from './composition/BackendRoute';
import ConsentGate from './features/accounts/ui/ConsentGate';

import './styles/reset.css';
import './styles/brand.css';
import './styles/colors.css';
import './styles/typography.css';
import './styles/utils.css';
import './App.css';

const Home = lazy(() => import('./pages/Home/Home'));
const Teachers = lazy(() => import('./pages/Teachers/Teachers'));
const DanceGenres = lazy(() => import('./pages/DanceGenres/DanceGenres'));
const Schedules = lazy(() => import('./pages/Schedules/Schedules'));
const Contact = lazy(() => import('./pages/Contact/Contact'));
const Login = lazy(() => import('./pages/Login/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback/AuthCallback'));
const AuthConfirm = lazy(() => import('./pages/AuthConfirm/AuthConfirm'));
const Account = lazy(() => import('./pages/Account/Account'));
const Privacy = lazy(() => import('./pages/Privacy/Privacy'));
const AdminFrame = lazy(() => import('./pages/Admin/AdminFrame'));
const AdminMembers = lazy(() => import('./pages/Admin/AdminMembers'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

export default function App() {
  return (
    <div className="App">
      <Header />
      <Suspense fallback={<Loader loaderName="grid" />}>
        <ConsentGate>
          <Routes>
            <Route index element={<Home />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:teacherId" element={<Teachers />} />
            <Route path="/dances/*" element={<DanceGenres />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/contact" element={<Contact />} />
            {/* The account pages exist only while the backend is on. */}
            <Route path="/login" element={<BackendRoute><Login /></BackendRoute>} />
            <Route
              path="/auth/callback"
              element={<BackendRoute><AuthCallback /></BackendRoute>}
            />
            {/* The link of a confirmation or recovery email; it verifies on a button press. */}
            <Route
              path="/auth/confirm"
              element={<BackendRoute><AuthConfirm /></BackendRoute>}
            />
            <Route path="/account" element={<BackendRoute><Account /></BackendRoute>} />
            {/*
              * The notice is static and the consent gate lets it through, so a
              * member whose consent is pending can read what they are asked to
              * accept.
              */}
            <Route path="/privacy" element={<BackendRoute><Privacy /></BackendRoute>} />
            {/*
              * The admin pages: behind the kill switch like the account pages and
              * then behind the admin check, which mounts nothing for anyone else.
              * They share one frame (the heading of the area and the
              * sub-navigation), so a new admin page is one more route here and one
              * more entry in the frame. The layout route has no path of its own,
              * which leaves /admin on its own answering not found.
              */}
            <Route
              element={<BackendRoute><AdminRoute><AdminFrame /></AdminRoute></BackendRoute>}
            >
              <Route path="/admin/members" element={<AdminMembers />} />
            </Route>
            {/*
              * Last, and matching whatever the ones above did not. Without it an
              * address nobody recognises rendered the nav and the footer with
              * nothing between them, which reads as a broken site rather than a
              * wrong turn.
              */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ConsentGate>
      </Suspense>
      <Footer />
    </div>
  );
}
