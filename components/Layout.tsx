import React from 'react';
import { LayoutDashboard, PenTool, Settings as SettingsIcon, LogOut, Cpu, FolderKanban, CheckCircle } from 'lucide-react';
import { ClientProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavigate: (tab: string) => void;
  currentProfile: ClientProfile;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onNavigate, currentProfile, onLogout }) => {
  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => onNavigate(id)}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-semibold transition-all duration-200 relative overflow-hidden group ${isActive
            ? 'text-slate-900 bg-slate-100 shadow-sm'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
      >
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-blue-700 rounded-r-full"></div>}
        <Icon size={22} className={isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'} />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex font-sans text-slate-900">
      {/* Sidebar */}
      <div className="w-72 bg-white flex flex-col fixed inset-y-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-slate-100">
        <div className="p-8">
          <div className="flex items-center gap-3 text-slate-900 font-bold text-xl tracking-tight">
            <div className="bg-slate-900 p-2 rounded-xl text-white">
              <Cpu size={18} fill="none" />
            </div>
            <span>MuseOS</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">B2B</span>
          </div>
        </div>

        {/* User Info */}
        <div className="px-8 pb-8">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <img src={currentProfile.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" alt="Avatar" />
            <div>
              <p className="text-sm font-bold text-slate-900">{currentProfile.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Consultor Activo</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-2 flex-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="content" icon={FolderKanban} label="Gestión Contenido" />
          <NavItem id="settings" icon={SettingsIcon} label="Estrategia" />
        </div>

        <div className="p-8">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all font-medium text-sm"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
          <p className="text-center text-[10px] text-slate-300 mt-4">MuseOS v3.0</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-72 overflow-auto relative">
        {children}
      </div>
    </div>
  );
};

export default Layout;