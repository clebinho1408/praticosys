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
  CalendarCheck,
  User as UserIcon,
  Menu
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
       items.push({ icon: Users, label: 'Meus Candidatos', path: '/admin/students' });
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row print:bg-white">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 print:hidden z-20">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-bold text-gray-800 tracking-tight">PráticoSys</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {getNavItems().map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'text-blue-600' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        
        {/* Rodapé da Sidebar (Versão Compacta) */}
        <div className="p-4 border-t border-gray-100 text-xs text-center text-gray-400">
           v1.0.0
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 print:hidden">
            {/* Mobile Toggle Placeholder / Page Title */}
            <div className="flex items-center gap-4">
                <button className="md:hidden text-gray-500">
                    <Menu className="h-6 w-6" />
                </button>
                {/* Breadcrumb or Title placeholder */}
            </div>

            {/* Right Side: User Profile & Logout */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-700">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                    <div className="h-9 w-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {user.name.charAt(0)}
                    </div>
                </div>
                
                <div className="h-8 w-px bg-gray-200 mx-1"></div>

                <button 
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-50"
                    title="Sair do Sistema"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-auto bg-gray-50 p-6 md:p-8 print:p-0 print:bg-white">
          <div className="max-w-7xl mx-auto print:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;