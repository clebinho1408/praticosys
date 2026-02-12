import React, { useState, useEffect } from 'react';
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
  Menu,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Map,
  Car,
  Accessibility,
  BarChart3
} from 'lucide-react';

interface SubItem {
  label: string;
  path: string;
  icon?: React.ElementType;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  subItems?: SubItem[];
  roles?: UserRole[];
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) => {
    if (item.path && isActive(item.path)) return true;
    return item.subItems?.some(sub => isActive(sub.path));
  };

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Auto-expand menu if a sub-item is active on load
  useEffect(() => {
    const navItems = getNavItems();
    const newOpenMenus: Record<string, boolean> = {};
    navItems.forEach(item => {
      if (item.subItems?.some(sub => isActive(sub.path))) {
        newOpenMenus[item.label] = true;
      }
    });
    if (Object.keys(newOpenMenus).length > 0) {
      setOpenMenus(prev => ({ ...prev, ...newOpenMenus }));
    }
  }, [location.pathname]);

  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' }
    ];

    if (user.role === UserRole.SCHOOL) {
       items.push({ 
         icon: ClipboardList, 
         label: 'Solicitações', 
         subItems: [
           { label: 'Todas solicitações', path: '/admin/requests' },
           { label: 'Meus Candidatos', path: '/admin/students' }
         ]
       });
    } else {
       // --- GRUPO: CNH DO BRASIL ---
       items.push({
         icon: Map,
         label: 'CNH do Brasil',
         subItems: [
           { label: 'Agendamentos', path: '/admin/scheduling/common', icon: CalendarCheck },
           { label: 'Candidatos', path: '/admin/requests/common', icon: FileText },
           { label: 'Relatórios', path: '/admin/reports/cnh', icon: BarChart3 } // Placeholder
         ]
       });

       // --- GRUPO: PROVA PRÁTICA CFC ---
       items.push({
         icon: Car,
         label: 'Prova Prática CFC',
         subItems: [
           { label: 'Agendamentos', path: '/admin/scheduling/cfc', icon: CalendarCheck }, // Placeholder
           { label: 'Candidatos', path: '/admin/requests/cfc', icon: FileText }, // Placeholder
           { label: 'Relatórios', path: '/admin/reports/cfc', icon: BarChart3 } // Placeholder
         ]
       });

       // --- GRUPO: PROVA PRÁTICA PCD ---
       items.push({
         icon: Accessibility,
         label: 'Prova Prática PCD',
         subItems: [
           { label: 'Agendamentos', path: '/admin/scheduling/pcd', icon: CalendarCheck }, // Placeholder
           { label: 'Candidatos', path: '/admin/requests/pcd', icon: FileText }, // Atual PCD
           { label: 'Relatórios', path: '/admin/reports/pcd', icon: BarChart3 } // Placeholder
         ]
       });
    }

    // --- CADASTROS E CONFIGURAÇÕES (Mantidos conforme solicitado) ---
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      items.push({ icon: Users, label: 'Cadastros', path: '/admin/users' });
      items.push({ icon: Settings, label: 'Configurações', path: '/admin/settings' });
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row print:bg-white">
      {/* Sidebar (Dark Theme) */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 print:hidden z-20 transition-all duration-300">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-900">
          <div className="bg-white/10 p-1.5 rounded-lg">
             <Logo className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">PráticoSys</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {getNavItems().map((item) => {
            const hasSubmenu = !!item.subItems;
            const isOpen = openMenus[item.label];
            const activeParent = isParentActive(item);

            return (
              <div key={item.label} className="space-y-1">
                {hasSubmenu ? (
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                      activeParent ? 'bg-slate-800/50 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`h-5 w-5 transition-colors ${activeParent ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <Link
                    to={item.path!}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                      isActive(item.path!)
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 transition-colors ${isActive(item.path!) ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                    <span>{item.label}</span>
                  </Link>
                )}

                {/* Submenu Items */}
                {hasSubmenu && isOpen && (
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 animate-fadeIn">
                    {item.subItems!.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                          isActive(sub.path)
                            ? 'text-blue-400 bg-blue-400/10'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/30'
                        }`}
                      >
                        {sub.icon && <sub.icon className="h-3.5 w-3.5 opacity-70" />}
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        
        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-slate-800 text-[10px] text-center text-slate-600 uppercase tracking-widest">
           PráticoSys v1.0.0
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 print:hidden shadow-sm z-10">
            <div className="flex items-center gap-4">
                <button className="md:hidden text-gray-500">
                    <Menu className="h-6 w-6" />
                </button>
                <div className="hidden md:block">
                   <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      {location.pathname.includes('scheduling') ? 'Gestão de Bancas' : 
                       location.pathname.includes('requests') ? 'Gestão de Candidatos' : 
                       location.pathname.includes('users') ? 'Administração' : 'Início'}
                   </h2>
                </div>
            </div>

            {/* Right Side: User Profile & Logout */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">{user.role}</p>
                    </div>
                    <div className="h-9 w-9 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-bold shadow-inner border border-blue-100">
                        {user.name.charAt(0)}
                    </div>
                </div>
                
                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-all text-sm font-medium"
                    title="Sair do Sistema"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sair</span>
                </button>
            </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-auto bg-gray-50/50 p-6 md:p-8 print:p-0 print:bg-white relative">
          <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-blue-50/50 to-transparent -z-10 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto print:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;