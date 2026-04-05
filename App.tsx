
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthState, User, UserRole } from './types';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CnhDoBrasil from './pages/CnhDoBrasil';
import CnhDoBrasilReport from './pages/CnhDoBrasilReport';
import ProvaPraticaCFC from './pages/ProvaPraticaCFC';
import ProvaPraticaCFCReport from './pages/ProvaPraticaCFCReport';
import ProvaPraticaPCD from './pages/ProvaPraticaPCD';
import ProvaPraticaPCDReport from './pages/ProvaPraticaPCDReport';
import Cadastros from './pages/Cadastros';
import Configuracoes from './pages/Configuracoes';
import StudentDatabase from './pages/StudentDatabase';
import ProvaPraticaCFCDashboard from './pages/ProvaPraticaCFCDashboard';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const savedAuth = localStorage.getItem('praticosys_auth');
    if (savedAuth) {
      try {
        return JSON.parse(savedAuth);
      } catch (e) {
        console.error('Failed to parse saved auth', e);
      }
    }
    return {
      user: null,
      isAuthenticated: false
    };
  });

  const handleLogin = (user: User) => {
    const newAuth = { user, isAuthenticated: true };
    setAuth(newAuth);
    localStorage.setItem('praticosys_auth', JSON.stringify(newAuth));
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('praticosys_auth');
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Redirect Root to Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth Route */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />

        {/* Protected Routes */}
        <Route
          path="/admin/*"
          element={
            auth.isAuthenticated && auth.user ? (
              <Layout user={auth.user} onLogout={handleLogout}>
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      auth.user?.role === UserRole.SCHOOL || auth.user?.role === UserRole.EXAMINER
                        ? <Navigate to="/admin/scheduling/cfc" replace /> 
                        : <AdminDashboard user={auth.user!} />
                    } 
                  />
                  
                  {/* CNH do Brasil */}
                  <Route path="dashboard/cnh" element={<CnhDoBrasil user={auth.user} view="dashboard" />} />
                  <Route path="requests/common" element={<CnhDoBrasil user={auth.user} view="requests" />} />
                  <Route path="scheduling/common" element={<CnhDoBrasil user={auth.user} view="scheduling" />} />
                  <Route path="reports/cnh" element={<CnhDoBrasilReport />} />

                  {/* Prova Prática CFC */}
                  <Route path="dashboard/cfc" element={<ProvaPraticaCFCDashboard user={auth.user} />} />
                  <Route path="scheduling/cfc" element={<ProvaPraticaCFC user={auth.user} />} />
                  <Route path="reports/cfc" element={<ProvaPraticaCFCReport />} />

                  {/* Prova Prática PCD */}
                  <Route path="dashboard/pcd" element={<ProvaPraticaPCD user={auth.user} view="dashboard" />} />
                  <Route path="requests/pcd" element={<ProvaPraticaPCD user={auth.user} view="requests" />} />
                  <Route path="scheduling/pcd" element={<ProvaPraticaPCD user={auth.user} view="scheduling" />} />
                  <Route path="reports/pcd" element={<ProvaPraticaPCDReport />} />

                  {/* Cadastros */}
                  <Route path="users" element={<Cadastros />} />
                  
                  {/* Configurações */}
                  <Route path="settings" element={<Configuracoes />} />
                  
                  {/* Student Database */}
                  <Route path="students" element={<StudentDatabase />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
