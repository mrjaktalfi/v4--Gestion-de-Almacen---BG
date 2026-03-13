
import React from 'react';
import { UserRole } from '../types';
import { LogOut, LayoutDashboard, Settings, ShoppingCart, Truck, Shield, Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  onLogout: () => void;
  title: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, onLogout, title, theme, toggleTheme }) => {
  
  const getRoleColor = () => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-slate-900 border-b border-slate-700 dark:bg-slate-950 dark:border-slate-800';
      case UserRole.WEBMASTER: return 'bg-black border-b border-purple-500 dark:bg-slate-950';
      case UserRole.WAREHOUSE: return 'bg-blue-900 border-b border-blue-700 dark:bg-blue-950 dark:border-blue-900';
      case UserRole.STORE_MANAGER: return 'bg-white border-b border-gray-200 dark:bg-slate-900 dark:border-slate-800';
      default: return 'bg-white dark:bg-slate-900';
    }
  };

  const getTextColor = () => {
    if (role === UserRole.STORE_MANAGER) return 'text-gray-900 dark:text-white';
    return 'text-white';
  };

  const getRoleLabel = () => {
    switch(role) {
        case UserRole.ADMIN: return 'Administrador';
        case UserRole.WEBMASTER: return 'Webmaster';
        case UserRole.WAREHOUSE: return 'Almacén';
        case UserRole.STORE_MANAGER: return 'Local';
        default: return '';
    }
  }

  const Icon = () => {
     switch(role) {
        case UserRole.ADMIN: return <LayoutDashboard className="w-7 h-7 mr-3" />;
        case UserRole.WEBMASTER: return <Shield className="w-7 h-7 mr-3 text-purple-400" />;
        case UserRole.WAREHOUSE: return <Truck className="w-7 h-7 mr-3" />;
        case UserRole.STORE_MANAGER: return <ShoppingCart className="w-7 h-7 mr-3 text-brand-600 dark:text-brand-400" />;
        default: return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      <header className={`${getRoleColor()} transition-colors duration-300 shadow-sm sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className={`flex items-center ${getTextColor()}`}>
              <Icon />
              <div>
                <span className="text-[9px] uppercase tracking-widest opacity-60 font-bold block mb-0.5 leading-none">Believe Group</span>
                <h1 className="text-xl font-bold tracking-tight leading-none">{title}</h1>
                <span className="text-[10px] opacity-75 font-medium uppercase tracking-wider block mt-0.5 leading-none">{getRoleLabel()}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 transition-colors ${getTextColor()}`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              <button
                onClick={onLogout}
                className={`p-2 rounded-md hover:bg-opacity-20 hover:bg-gray-500 transition-colors flex items-center gap-2 ${getTextColor()}`}
              >
                <span className="text-sm font-medium hidden sm:inline">Salir</span>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};
