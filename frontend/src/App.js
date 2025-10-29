
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import NavigationLayout from './components/NavigationLayout';

function App() {
  // Aquí puedes agregar lógica de autenticación y rutas protegidas si lo necesitas
  return (
    <Router>
      <NavigationLayout>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Agrega más rutas según tu estructura */}
        </Routes>
      </NavigationLayout>
    </Router>
  );
}

export default App;
