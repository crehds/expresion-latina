import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

import { Footer, Header } from './components';
import Loader from './components/Loader/Loader';

import './styles/reset.css';
import './styles/colors.css';
import './styles/typography.css';
import './styles/utils.css';
import './App.css';

const Home = lazy(() => import('./pages/Home/Home'));
const Teachers = lazy(() => import('./pages/Teachers/Teachers'));
const DanceGenres = lazy(() => import('./pages/DanceGenres/DanceGenres'));

export default function App() {
  return (
    <div className="App">
      <Header />
      <Suspense fallback={<Loader loaderName="grid" />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/dances/*" element={<DanceGenres />} />
        </Routes>
      </Suspense>
      <Footer />
    </div>
  );
}
