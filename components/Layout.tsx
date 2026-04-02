
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
  X,
  ChevronDown,
  ChevronRight,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getRoleLabel = (role: string) => {
    switch(role) {
      case UserRole.ADMIN: return 'Administrador';
      case UserRole.SUPERVISOR: return 'Supervisor';
      case UserRole.OPERATOR: return 'Operador';
      case UserRole.SCHOOL: return 'Autoescola';
      case UserRole.EXAMINER: return 'Examinador';
      default: return role;
    }
  };

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
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    if (user.role === UserRole.SCHOOL || user.role === UserRole.EXAMINER) {
       items.push({
         icon: CalendarCheck,
         label: 'Agendamentos',
         path: '/admin/scheduling/cfc'
       });
    } else {
       items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/admin' });

       // --- GRUPO: CNH DO BRASIL ---
       items.push({
         icon: Map,
         label: 'CNH do Brasil',
         subItems: [
           { label: 'Dashboard', path: '/admin/dashboard/cnh', icon: LayoutDashboard },
           { label: 'Agendamentos', path: '/admin/scheduling/common', icon: CalendarCheck },
           { label: 'Candidatos', path: '/admin/requests/common', icon: FileText },
           { label: 'Relatórios', path: '/admin/reports/cnh', icon: BarChart3 }
         ]
       });

       // --- GRUPO: PROVA PRÁTICA CFC ---
       items.push({
         icon: Car,
         label: 'Prova Prática CFC',
         subItems: [
           { label: 'Agendamentos', path: '/admin/scheduling/cfc', icon: CalendarCheck },
           { label: 'Relatórios', path: '/admin/reports/cfc', icon: BarChart3 }
         ]
       });

       // --- GRUPO: PROVA PRÁTICA PCD ---
       items.push({
         icon: Accessibility,
         label: 'Prova Prática PCD',
         subItems: [
           { label: 'Dashboard', path: '/admin/dashboard/pcd', icon: LayoutDashboard },
           { label: 'Agendamentos', path: '/admin/scheduling/pcd', icon: CalendarCheck },
           { label: 'Candidatos', path: '/admin/requests/pcd', icon: FileText },
           { label: 'Relatórios', path: '/admin/reports/pcd', icon: BarChart3 }
         ]
       });
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      items.push({ icon: Users, label: 'Cadastros', path: '/admin/users' });
      items.push({ icon: Settings, label: 'Configurações', path: '/admin/settings' });
    }

    return items;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="bg-white/10 p-1.5 rounded-lg">
           <Logo className="h-6 w-6" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">PráticoSys</span>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto text-slate-400 p-2 hover:bg-slate-800 rounded-lg">
           <X className="h-6 w-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {getNavItems().map((item) => {
          const hasSubmenu = !!item.subItems;
          const isOpen = openMenus[item.label];
          const activeParent = isParentActive(item);

          return (
            <div key={item.label} className="space-y-1">
              {hasSubmenu ? (
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                    activeParent ? 'bg-slate-800/80 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                    isActive(item.path!)
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className={`h-5 w-5 transition-colors ${isActive(item.path!) ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </Link>
              )}

              {hasSubmenu && isOpen && (
                <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 animate-fadeIn">
                  {item.subItems!.map((sub) => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-tight transition-all duration-200 ${
                        isActive(sub.path)
                          ? 'text-blue-400 bg-blue-400/10'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
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
      
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
         <div className="text-[10px] text-center text-slate-600 uppercase tracking-widest font-black">
            PráticoSys v1.0.0
         </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row print:bg-white h-screen overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col flex-shrink-0 print:hidden z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <div className={`md:hidden fixed inset-0 z-[100] transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className={`absolute top-0 left-0 h-full w-72 bg-slate-900 shadow-2xl transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <SidebarContent />
          </aside>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 print:h-auto print:overflow-visible">
        <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-4 md:px-8 print:hidden shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-500 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <Menu className="h-6 w-6" />
                </button>
                <div className="hidden md:block">
                   <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                      {location.pathname.includes('scheduling') ? 'Gestão de Prova Prática CFC' : 
                       location.pathname.includes('requests') ? 'Gestão de Candidatos' : 
                       location.pathname.includes('reports') ? 'Relatórios e Análises' :
                       location.pathname.includes('users') ? 'Administração' : 'Painel Principal'}
                   </h2>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tighter">{user.name}</p>
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest opacity-80">{getRoleLabel(user.role)}</p>
                    </div>
                    <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-black border border-slate-200 shadow-sm">
                        {user.name.charAt(0)}
                    </div>
                </div>
                
                <div className="h-8 w-px bg-slate-100 mx-1 hidden sm:block"></div>

                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 md:px-3 md:py-2 rounded-xl transition-all text-xs font-black uppercase tracking-wider"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="hidden lg:inline">Sair</span>
                </button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-8 print:p-0 print:bg-white relative custom-scrollbar print:overflow-visible print:h-auto">
          <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-blue-100/20 to-transparent -z-10 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto print:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
