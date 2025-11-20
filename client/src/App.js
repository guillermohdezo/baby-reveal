import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GuestInterface from './components/GuestInterface';
import AdminPanel from './components/AdminPanel';
import ProjectionScreen from './components/ProjectionScreen';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<GuestInterface />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/projection" element={<ProjectionScreen />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;