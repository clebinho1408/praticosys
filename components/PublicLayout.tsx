import React from 'react';
import { Link } from 'react-router-dom';
import { Search, LogIn } from 'lucide-react';
import { Logo } from './Logo';

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-10 w-10" />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 leading-none">PráticoSys</span>
                <span className="text-xs text-gray-500 font-medium">Portal de Agendamento</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
               <Link to="/status" className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center gap-1">
                 <Search className="h-4 w-4" />
                 Consultar Status
               </Link>
               <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2">
                 <LogIn className="h-4 w-4" />
                 Acesso Restrito
               </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} PráticoSys. Todos os direitos reservados.</p>
          <p className="mt-2">Sistema de Gestão de Provas Práticas</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;