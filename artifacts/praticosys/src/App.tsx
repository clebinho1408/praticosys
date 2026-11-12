
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole, OperatorModule } from './types';
import Layout from './components/Layout';
import { useAuthSession } from './services/useAuthSession';

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
  const { auth, status, retry, handleLogin, handleLogout } = useAuthSession();

  const hasModuleRestrictions =
    auth.user?.role === UserRole.OPERATOR || auth.user?.role === UserRole.SUPERVISOR;
  const allowedModules: OperatorModule[] =
    hasModuleRestrictions && auth.user?.allowedModules && auth.user.allowedModules.length > 0
      ? auth.user.allowedModules
      : ['cnh', 'cfc', 'pcd'];
  const canAccessModule = (module: OperatorModule) =>
    !hasModuleRestrictions || allowedModules.includes(module);
  const restrictedUserHome = () => {
    const first = allowedModules[0];
    if (first === 'cnh') return '/admin/cnhdobrasil/candidatos';
    if (first === 'cfc') return '/admin/cfc/agendamentos';
    if (first === 'pcd') return '/admin/pcd/candidatos';
    return '/admin/dashboard';
  };
  const protectModule = (module: OperatorModule, element: React.ReactElement) =>
    canAccessModule(module) ? element : <Navigate to={restrictedUserHome()} replace />;

  if (status !== 'ready') {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center space-y-4" role="status" aria-live="polite">
          <h1 className="text-lg font-bold text-slate-800">
            {status === 'checking' ? 'Verificando sua sessão…' : 'Não foi possível verificar sua sessão'}
          </h1>
          {status === 'unavailable' && <>
            <p className="text-sm text-slate-600">Verifique sua conexão e tente novamente. Seu login salvo não foi apagado.</p>
            <button type="button" onClick={retry} className="w-full bg-blue-600 text-white rounded-lg p-3 font-bold">Tentar novamente</button>
            <button type="button" onClick={handleLogout} className="w-full text-slate-600 rounded-lg p-3">Sair deste aparelho</button>
          </>}
        </div>
      </main>
    );
  }

  const entryPath = auth.isAuthenticated && auth.user ? '/admin' : '/login';

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Installed shortcuts can reopen at the root or a saved login URL. */}
        <Route path="/" element={<Navigate to={entryPath} replace />} />
        
        {/* Auth Route */}
        <Route path="/login" element={
          auth.isAuthenticated && auth.user
            ? <Navigate to="/admin" replace />
            : <Login onLogin={handleLogin} />
        } />

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
                        : (auth.user?.role === UserRole.OPERATOR || auth.user?.role === UserRole.SUPERVISOR)
                        ? <Navigate to={restrictedUserHome()} replace />
                        : <Navigate to="/admin/dashboard" replace />
                    } 
                  />

                  {/* Dashboard Geral */}
                  <Route
                    path="dashboard"
                    element={
                      hasModuleRestrictions
                        ? <Navigate to={restrictedUserHome()} replace />
                        : <DashboardGeral user={auth.user!} />
                    }
                  />
                  
                  {/* ══════════════════════════════════════════════════════ */}
                  {/* CNH do Brasil — rotas em PT-BR                        */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <Route path="cnhdobrasil/dashboard"   element={protectModule('cnh', <CnhDoBrasil user={auth.user} view="dashboard" />)} />
                  <Route path="cnhdobrasil/bancas"      element={protectModule('cnh', <CnhDoBrasil user={auth.user} view="scheduling" />)} />
                  <Route path="cnhdobrasil/candidatos"  element={protectModule('cnh', <CnhDoBrasil user={auth.user} view="requests" />)} />
                  <Route path="cnhdobrasil/relatorios"  element={protectModule('cnh', <CnhDoBrasilReport user={auth.user} />)} />
                  {/* Aliases legados — redirecionam para as novas rotas PT-BR */}
                  <Route path="dashboard/cnh"      element={protectModule('cnh', <Navigate to="/admin/cnhdobrasil/dashboard"  replace />)} />
                  <Route path="requests/common"    element={protectModule('cnh', <Navigate to="/admin/cnhdobrasil/candidatos" replace />)} />
                  <Route path="scheduling/common"  element={protectModule('cnh', <Navigate to="/admin/cnhdobrasil/bancas"     replace />)} />
                  <Route path="reports/cnh"        element={protectModule('cnh', <Navigate to="/admin/cnhdobrasil/relatorios" replace />)} />

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* Prova Prática CFC — rotas em PT-BR                    */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <Route path="cfc/dashboard"    element={protectModule('cfc', <ProvaPraticaCFCDashboard user={auth.user} />)} />
                  <Route path="cfc/agendamentos" element={protectModule('cfc', <ProvaPraticaCFC user={auth.user} />)} />
                  <Route path="cfc/relatorios"   element={protectModule('cfc', <ProvaPraticaCFCReport user={auth.user} />)} />
                  {/* Aliases legados */}
                  <Route path="dashboard/cfc"  element={protectModule('cfc', <Navigate to="/admin/cfc/dashboard"    replace />)} />
                  <Route path="scheduling/cfc" element={protectModule('cfc', <Navigate to="/admin/cfc/agendamentos" replace />)} />
                  <Route path="reports/cfc"    element={protectModule('cfc', <Navigate to="/admin/cfc/relatorios"   replace />)} />

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* Prova Prática PCD — rotas em PT-BR                    */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <Route path="pcd/dashboard"    element={protectModule('pcd', <ProvaPraticaPCD user={auth.user} view="dashboard" />)} />
                  <Route path="pcd/agendamentos" element={protectModule('pcd', <ProvaPraticaPCD user={auth.user} view="scheduling" />)} />
                  <Route path="pcd/candidatos"   element={protectModule('pcd', <ProvaPraticaPCD user={auth.user} view="requests" />)} />
                  <Route path="pcd/relatorios"   element={protectModule('pcd', <ProvaPraticaPCDReport user={auth.user} />)} />
                  {/* Aliases legados */}
                  <Route path="dashboard/pcd"  element={protectModule('pcd', <Navigate to="/admin/pcd/dashboard"    replace />)} />
                  <Route path="requests/pcd"   element={protectModule('pcd', <Navigate to="/admin/pcd/candidatos"   replace />)} />
                  <Route path="scheduling/pcd" element={protectModule('pcd', <Navigate to="/admin/pcd/agendamentos" replace />)} />
                  <Route path="reports/pcd"    element={protectModule('pcd', <Navigate to="/admin/pcd/relatorios"   replace />)} />

                  {/* Cadastros - ADMIN completo; SUPERVISOR somente Instrutores */}
                  <Route 
                    path="usuarios" 
                    element={
                      auth.user?.role === UserRole.ADMIN || auth.user?.role === UserRole.SUPERVISOR
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
                  <Route
                    path="alunos"
                    element={
                      hasModuleRestrictions
                        ? <Navigate to={restrictedUserHome()} replace />
                        : <StudentDatabase />
                    }
                  />
                  <Route
                    path="students"
                    element={
                      hasModuleRestrictions
                        ? <Navigate to={restrictedUserHome()} replace />
                        : <Navigate to="/admin/alunos" replace />
                    }
                  />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to={entryPath} replace />} />
      </Routes>
    </Router>
  );
};

export default App;
