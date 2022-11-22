import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Footer, Header } from './components';

export default function App() {
  return (
    <div className="App">
      <Header />
      <Routes>
        <Route index element={<div>Restarting the app</div>} />
      </Routes>
      <Footer />
    </div>
  );
}
