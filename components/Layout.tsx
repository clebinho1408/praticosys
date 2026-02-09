import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import { Logo } from './Logo';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  CalendarCheck
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const getNavItems = () => {
    const items = [];

    // Dashboard available to all logged in
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/admin' });

    if (user.role === UserRole.SCHOOL) {
       items.push({ icon: FileText, label: 'Minhas Solicitações', path: '/admin/requests' });
       items.push({ icon: Users, label: 'Meus Candidatos', path: '/admin/students' }); // Placeholder
    } else {
       // Admin/Supervisor/Operator
       items.push({ icon: CalendarCheck, label: 'Agendamentos', path: '/admin/scheduling/common' });
       items.push({ icon: FileText, label: 'Candidatos', path: '/admin/requests/common' });
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      items.push({ icon: Users, label: 'Cadastros', path: '/admin/users' });
      items.push({ icon: Settings, label: 'Configurações', path: '/admin/settings' });
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row print:bg-white">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 print:hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-700">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-bold">PráticoSys</h1>
            <p className="text-xs text-slate-400">Gestão de Exames</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {getNavItems().map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto print:overflow-visible">
        <header className="bg-white shadow-sm sticky top-0 z-10 md:hidden print:hidden">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Logo className="h-6 w-6" />
                    <span className="font-bold text-slate-800">PráticoSys</span>
                </div>
                {/* Mobile menu button could go here */}
            </div>
        </header>
        <div className="p-6 md:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;