import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { AlertTriangle, Activity, ShieldCheck, ArrowLeft, Mail } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  // Etapa 1 — credenciais
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  // Etapa 2 — OTP
  const [pendingUserId, setPendingUserId] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState('');  // apenas em ambiente de dev sem Resend configurado
  const [otpCode, setOtpCode] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(login, password);

      if (response?.requiresOtp) {
        setPendingUserId(response.userId);
        setSentTo(response.sentTo ?? '');
        setDevCode(response.devCode ?? '');
        setOtpCode('');
        setStep('otp');
      } else if (response?.id) {
        onLogin(response as User);
        navigate('/admin');
      } else {
        setError('Credenciais inválidas ou usuário não encontrado.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setError('Digite os 6 dígitos do código.'); return; }
    setLoading(true);
    setError('');

    try {
      const user = await api.verifyOtp(pendingUserId, otpCode);
      onLogin(user);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
    <div className="rounded-md bg-red-50 p-4 border border-red-100 animate-fadeIn">
      <div className="flex">
        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
        <p className="ml-3 text-sm font-medium text-red-800">{msg}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 z-0" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-white rounded-2xl shadow-xl flex items-center justify-center p-3">
            <Logo className="h-full w-full" />
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white">PráticoSys</h2>
        <p className="mt-2 text-center text-sm text-blue-200">Sistema de Gestão de Exames Práticos</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-black/20 rounded-xl sm:px-10 border border-white/10">

          {/* ── Etapa 1: Credenciais ── */}
          {step === 'credentials' && (
            <form className="space-y-6" onSubmit={handleCredentials}>
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-gray-700">Usuário</label>
                <input
                  id="login" name="login" type="text" required autoFocus autoComplete="username"
                  value={login} onChange={e => setLogin(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
                <input
                  id="password" name="password" type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 text-gray-900"
                />
              </div>

              {error && <ErrorBox msg={error} />}

              <button
                type="submit" disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading
                  ? <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Acessando...</span>
                  : 'Entrar no Sistema'}
              </button>
            </form>
          )}

          {/* ── Etapa 2: Código OTP ── */}
          {step === 'otp' && (
            <form className="space-y-6" onSubmit={handleOtp}>
              <div className="text-center space-y-2">
                <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Verificação em 2 etapas</h3>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>Código enviado para <strong>{sentTo}</strong></span>
                </div>
                {devCode && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                    <strong>Ambiente de desenvolvimento</strong> — e-mail não enviado<br />
                    Código: <span className="font-mono font-bold text-base tracking-widest">{devCode}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 text-center mb-2">
                  Digite o código de 6 dígitos
                </label>
                <input
                  id="otp" type="text" inputMode="numeric" maxLength={6} required autoFocus
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm text-center text-3xl font-bold tracking-[0.5em] focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-900"
                  placeholder="——————"
                />
                <p className="text-xs text-gray-400 text-center mt-1">Válido por 10 minutos · máximo 5 tentativas</p>
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="space-y-3">
                <button
                  type="submit" disabled={loading || otpCode.length !== 6}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading
                    ? <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Verificando...</span>
                    : 'Confirmar Acesso'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(''); setOtpCode(''); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar e usar outras credenciais
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
