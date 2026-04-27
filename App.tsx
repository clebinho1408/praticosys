
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthState, User, UserRole } from './types';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
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
import DashboardGeral from './pages/DashboardGeral';

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
                      auth.user?.role === UserRole.SCHOOL
                        ? <Navigate to="/admin/cfc/agendamentos" replace />
                        : auth.user?.role === UserRole.EXAMINER
                        ? <Navigate to="/admin/cfc/agendamentos" replace /> 
                        : auth.user?.role === UserRole.INSTRUCTOR
                        ? <Navigate to="/admin/cnhdobrasil/candidatos" replace />
                        : <Navigate to="/admin/dashboard" replace />
                    } 
                  />

                  {/* Dashboard Geral */}
                  <Route path="dashboard" element={<DashboardGeral user={auth.user!} />} />
                  
                  {/* CNH do Brasil — rotas em PT-BR */}
                  <Route path="cnhdobrasil/dashboard"   element={<CnhDoBrasil user={auth.user} view="dashboard" />} />
                  <Route path="cnhdobrasil/bancas"      element={<CnhDoBrasil user={auth.user} view="scheduling" />} />
                  <Route path="cnhdobrasil/candidatos"  element={<CnhDoBrasil user={auth.user} view="requests" />} />
                  <Route path="cnhdobrasil/relatorios"  element={<CnhDoBrasilReport user={auth.user} />} />
                  {/* Aliases legados (redirecionam para as novas rotas) */}
                  <Route path="dashboard/cnh"      element={<Navigate to="/admin/cnhdobrasil/dashboard"  replace />} />
                  <Route path="requests/common"    element={<Navigate to="/admin/cnhdobrasil/candidatos" replace />} />
                  <Route path="scheduling/common"  element={<Navigate to="/admin/cnhdobrasil/bancas"     replace />} />
                  <Route path="reports/cnh"        element={<Navigate to="/admin/cnhdobrasil/relatorios" replace />} />

                  {/* Prova Prática CFC — rotas em PT-BR */}
                  <Route path="cfc/dashboard"    element={<ProvaPraticaCFCDashboard user={auth.user} />} />
                  <Route path="cfc/agendamentos" element={<ProvaPraticaCFC user={auth.user} />} />
                  <Route path="cfc/relatorios"   element={<ProvaPraticaCFCReport user={auth.user} />} />
                  {/* Aliases legados */}
                  <Route path="dashboard/cfc"  element={<Navigate to="/admin/cfc/dashboard"    replace />} />
                  <Route path="scheduling/cfc" element={<Navigate to="/admin/cfc/agendamentos" replace />} />
                  <Route path="reports/cfc"    element={<Navigate to="/admin/cfc/relatorios"   replace />} />

                  {/* Prova Prática PCD — rotas em PT-BR */}
                  <Route path="pcd/dashboard"   element={<ProvaPraticaPCD user={auth.user} view="dashboard" />} />
                  <Route path="pcd/agendamentos" element={<ProvaPraticaPCD user={auth.user} view="scheduling" />} />
                  <Route path="pcd/candidatos"  element={<ProvaPraticaPCD user={auth.user} view="requests" />} />
                  <Route path="pcd/relatorios"  element={<ProvaPraticaPCDReport user={auth.user} />} />
                  {/* Aliases legados */}
                  <Route path="dashboard/pcd"  element={<Navigate to="/admin/pcd/dashboard"    replace />} />
                  <Route path="requests/pcd"   element={<Navigate to="/admin/pcd/candidatos"   replace />} />
                  <Route path="scheduling/pcd" element={<Navigate to="/admin/pcd/agendamentos" replace />} />
                  <Route path="reports/pcd"    element={<Navigate to="/admin/pcd/relatorios"   replace />} />

                  {/* Cadastros - ADMIN only */}
                  <Route 
                    path="usuarios" 
                    element={
                      auth.user?.role === UserRole.ADMIN
                        ? <Cadastros user={auth.user!} />
                        : <Navigate to="/admin/dashboard" replace />
                    } 
                  />
                  {/* Alias legado */}
                  <Route path="users" element={<Navigate to="/admin/usuarios" replace />} />
                  
                  {/* Configurações - ADMIN only */}
                  <Route 
                    path="configuracoes" 
                    element={
                      auth.user?.role === UserRole.ADMIN
                        ? <Configuracoes user={auth.user!} />
                        : <Navigate to="/admin/dashboard" replace />
                    } 
                  />
                  {/* Alias legado */}
                  <Route path="settings" element={<Navigate to="/admin/configuracoes" replace />} />
                  
                  {/* Student Database */}
                  <Route path="alunos"   element={<StudentDatabase />} />
                  <Route path="students" element={<Navigate to="/admin/alunos" replace />} />
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
