import { Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/reset.css';
import { Footer, Header } from './components';
import Home from './pages/Home/Home';

export default function App() {
  return (
    <div className="App">
      <Header />
      <Routes>
        <Route index element={<Home />} />
      </Routes>
      <Footer />
    </div>
  );
}
