import { Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';

export default function App() {
  return (
    <div className="App">
      <Header />
      <Routes>
        <Route index element={<div>Restarting the app</div>} />
      </Routes>
    </div>
  );
}
