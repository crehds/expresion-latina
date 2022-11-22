import { Routes, Route } from 'react-router-dom';
import './App.css';

export default function App() {
  return (
    <div className="App">
      <Routes>
        <Route index element={<div>Restarting the app</div>} />
      </Routes>
    </div>
  );
}
