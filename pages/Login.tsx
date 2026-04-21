import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { AlertTriangle, Activity, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState(''); 
  const [error, setError] = useState('');
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  
  const navigate = useNavigate();

  // Timer para mostrar opção de emergência se demorar
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setShowEmergency(true);
      }, 3500);
    } else {
      setShowEmergency(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDetailedError(null);
    setDiagResult(null);

    try {
      console.log("[Login] Iniciando tentativa de acesso...");
      const user = await api.login(login, password);
      
      if (user) {
        console.log("[Login] Sucesso! Redirecionando...");
        onLogin(user);
        navigate('/admin');
      } else {
        setError('Credenciais inválidas ou usuário não encontrado.');
      }
    } catch (err: any) {
        console.error("[Login] Erro capturado:", err);
        setError('Erro ao conectar com o servidor.');
        setDetailedError(err.message || "Servidor não respondeu a tempo.");
    } finally {
        setLoading(false);
    }
  };

  const handleEmergencyLogin = () => {
    console.log("[Login] Acionando Entrada de Emergência (Offline)");
    const emergencyAdmin: User = { 
      id: 'admin', 
      name: 'Admin (Emergência)', 
      login: 'admin', 
      role: UserRole.ADMIN 
    };
    onLogin(emergencyAdmin);
    navigate('/admin');
  };

  const runDiagnostics = async () => {
      setLoading(true);
      try {
          const res = await fetch('/api/test');
          const data = await res.json();
          setDiagResult(data);
      } catch (e: any) {
          setDiagResult({ status: 'ERROR', message: 'Falha ao rodar diagnóstico', details: e.message });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 z-0"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-white rounded-2xl shadow-xl flex items-center justify-center p-3">
                <Logo className="h-full w-full" />
            </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white">
          PráticoSys
        </h2>
        <p className="mt-2 text-center text-sm text-blue-200">
          Sistema de Gestão de Provas Práticas
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-black/20 rounded-xl sm:px-10 border border-white/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-gray-700">
                Usuário
              </label>
              <div className="mt-1">
                <input
                  id="login"
                  name="login"
                  type="text"
                  required
                  autoFocus
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 text-gray-900"
                  placeholder=""
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 text-gray-900"
                  placeholder=""
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-100 animate-fadeIn">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    {detailedError && (
                        <div className="mt-1 text-[10px] text-red-600 font-mono italic">
                            {detailedError}
                        </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 animate-spin" /> Acessando...
                    </div>
                ) : 'Entrar no Sistema'}
              </button>
              
              {showEmergency && (
                  <button 
                    type="button"
                    onClick={handleEmergencyLogin}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 p-2 rounded border border-blue-100 animate-bounce"
                  >
                     <ShieldAlert className="h-4 w-4" /> ENTRAR EM MODO OFFLINE (EMERGÊNCIA)
                  </button>
              )}
            </div>
            
            {(error || diagResult) && !showEmergency && (
                <div className="text-center">
                    <button 
                        type="button" 
                        onClick={runDiagnostics}
                        className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center justify-center gap-1 w-full mt-2"
                    >
                        <Activity className="h-3 w-3" /> Rodar Diagnóstico do Sistema
                    </button>
                </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;