
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthState, ExamType, User, UserRole } from './types';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import RequestManager from './pages/RequestManager';
import RegistryManagement from './pages/RegistryManagement';
import Settings from './pages/Settings';
import SchedulingCenter from './pages/SchedulingCenter';
import Reports from './pages/Reports';
import StudentDatabase from './pages/StudentDatabase';
import CFCSchedulingCenter from './pages/CFCSchedulingCenter';

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
                  <Route path="dashboard/:tab" element={<AdminDashboard user={auth.user} />} />
                  
                  {/* Common Routes for specific filters */}
                  <Route path="requests" element={<RequestManager user={auth.user} />} /> 
                  <Route path="requests/common" element={<RequestManager user={auth.user} typeFilter={ExamType.COMMON} />} />
                  <Route path="requests/pcd" element={<RequestManager user={auth.user} typeFilter={ExamType.PCD} />} />
                  <Route path="requests/cfc" element={<RequestManager user={auth.user} typeFilter={ExamType.COMMON} />} />
                  
                  {/* Scheduling Center */}
                  <Route path="scheduling/common" element={<SchedulingCenter user={auth.user} type={ExamType.COMMON} />} />
                  <Route path="scheduling/cfc" element={<CFCSchedulingCenter user={auth.user} />} />
                  <Route path="scheduling/pcd" element={<SchedulingCenter user={auth.user} type={ExamType.PCD} />} />

                  {/* Reports */}
                  <Route path="reports/:reportType" element={<Reports />} />

                  {/* Registries */}
                  <Route path="users" element={<RegistryManagement />} />
                  
                  {/* Settings */}
                  <Route path="settings" element={<Settings />} />
                  
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
