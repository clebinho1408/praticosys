import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { Lock, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';

interface Props {
  user: User;
  onSuccess: () => void;
}

export const ForcePasswordChangeModal: React.FC<Props> = ({ user, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Por favor, preencha ambos os campos.');
      return;
    }
    if (password === '123456') {
      setError('A nova senha não pode ser igual à senha padrão.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.changeOwnPassword(password);

      // Atualiza o localStorage para não exibir o modal novamente
      const savedAuth = localStorage.getItem('praticosys_auth');
      if (savedAuth) {
        const authCtx = JSON.parse(savedAuth);
        if (authCtx.user) authCtx.user.forcePasswordChange = false;
        localStorage.setItem('praticosys_auth', JSON.stringify(authCtx));
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-orange-500 p-6 flex flex-col items-center justify-center text-white">
          <div className="bg-white/20 p-4 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Alteração Obrigatória</h2>
          <p className="text-orange-50 text-center text-sm mt-2 opacity-90">
            Para sua segurança, é necessário cadastrar uma nova senha antes de acessar o sistema.
          </p>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Nova Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-medium"
                  placeholder="Mínimo de 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-medium"
                  placeholder="Digite a senha novamente"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-500/20 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Nova Senha
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
