
import React, { useState, useEffect } from 'react';
import { UserRole, UserSession, Venue, AppSettings } from './types';
import { subscribeToVenues, getSettings, subscribeToSettings } from './services/dbService';
import { Layout } from './components/Layout';
import { StoreView } from './components/StoreView';
import { WarehouseView } from './components/WarehouseView';
import { AdminView } from './components/AdminView';
import { WebmasterView } from './components/WebmasterView';
import { Truck, ShoppingCart, LayoutDashboard, Lock, ArrowRight, Database, Settings, Moon, Sun, ShieldCheck, FileText, Loader2, AlertCircle, Info, Unlock } from 'lucide-react';

interface AppProps {
  initialMode?: 'store' | 'warehouse' | 'admin';
  lockMode?: boolean;
}

export default function App({ initialMode = 'store', lockMode = false }: AppProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const urlMode = searchParams.get('mode');
  const urlLock = searchParams.get('lock') === 'true';

  let resolvedUrlMode: 'store' | 'warehouse' | 'admin' | null = null;
  let customTitle = '';

  if (urlMode === 'store') resolvedUrlMode = 'store';
  if (urlMode === 'warehouse' || urlMode === 'almacen') resolvedUrlMode = 'warehouse';
  if (urlMode === 'admin') resolvedUrlMode = 'admin';
  if (urlMode === 'developer' || urlMode === 'webmaster') {
      resolvedUrlMode = 'admin';
      customTitle = 'Acceso Webmaster';
  }

  const effectiveInitialMode = resolvedUrlMode || initialMode;
  const effectiveLockMode = lockMode || urlLock;
  const showAdminPassword = !effectiveLockMode || customTitle === 'Acceso Webmaster';

  const [session, setSession] = useState<UserSession>({
    role: UserRole.GUEST,
    isAuthenticated: false
  });
  const [venues, setVenues] = useState<Venue[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [loginMode, setLoginMode] = useState<'store' | 'warehouse' | 'admin'>(effectiveInitialMode);
  const [error, setError] = useState('');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [unlockCounter, setUnlockCounter] = useState(0);

  useEffect(() => {
    // Manejo de tema
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }

    // Suscripción a ajustes globales
    const unsubSettings = subscribeToSettings(setSettings);

    // Suscripción a locales (sin esperar a auth)
    const unsubVenues = subscribeToVenues(
      (data) => {
        setVenues(data);
        setPermissionError(null);
      },
      (err: any) => {
        console.error("Error al suscribirse a locales:", err);
        if (err.message && err.message.toLowerCase().includes("permission")) {
          setPermissionError("Permisos denegados en la base de datos.");
        } else {
          setPermissionError("Error de conexión con la base de datos.");
        }
      }
    );
    return () => {
      unsubVenues();
      unsubSettings();
    };
  }, []);

  // Update Favicon effect
  useEffect(() => {
    if (settings?.favicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.favicon;
    }
  }, [settings?.favicon]);

  useEffect(() => {
    if (effectiveLockMode) return;
    if (unlockCounter >= 5) {
      setIsAdminUnlocked(true);
      setLoginMode('admin');
      setError('');
      setPasscodeInput('');
    }
    const timer = setTimeout(() => {
      if (unlockCounter > 0 && unlockCounter < 5) {
        setUnlockCounter(0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [unlockCounter, effectiveLockMode]);

  const handleSecretClick = () => {
    if (!effectiveLockMode) {
      setUnlockCounter(prev => prev + 1);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const currentSettings = await getSettings();
      if (loginMode === 'store') {
        if (!selectedVenue) {
          setError('Selecciona un local.');
          return;
        }
        if (!currentSettings.storePasscodeEnabled || passcodeInput === currentSettings.storePasscode) {
          setSession({ role: UserRole.STORE_MANAGER, venueId: selectedVenue, isAuthenticated: true });
          return;
        }
      } else if (loginMode === 'warehouse') {
        if (!currentSettings.warehousePasscodeEnabled || passcodeInput === currentSettings.warehousePasscode) {
          setSession({ role: UserRole.WAREHOUSE, isAuthenticated: true });
          return;
        }
      } else if (loginMode === 'admin') {
        if (passwordInput === 'developer' && (!currentSettings.webmasterPasscodeEnabled || passcodeInput === currentSettings.webmasterPasscode)) {
          setSession({ role: UserRole.WEBMASTER, isAuthenticated: true });
          return;
        }
        if (!currentSettings.adminPasscodeEnabled || passcodeInput === currentSettings.adminPasscode) {
          setSession({ role: UserRole.ADMIN, isAuthenticated: true });
          return;
        }
      }
      setError('Código incorrecto.');
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("permission")) {
        setError('Error de permisos en la base de datos.');
      } else {
        setError('Error al conectar con el servidor.');
      }
    }
  };

  const handleLogout = () => {
    setSession({ role: UserRole.GUEST, isAuthenticated: false });
    setPasscodeInput('');
    setPasswordInput('');
    setSelectedVenue('');
    setLoginMode(effectiveInitialMode);
    setError('');
  };

  const isPasscodeNeeded = () => {
    if (!settings) return true;
    if (loginMode === 'store') return settings.storePasscodeEnabled;
    if (loginMode === 'warehouse') return settings.warehousePasscodeEnabled;
    if (loginMode === 'admin') {
      if (passwordInput === 'developer') return settings.webmasterPasscodeEnabled;
      return settings.adminPasscodeEnabled;
    }
    return true;
  };

  if (session.isAuthenticated) {
    let Content;
    let title = "";
    switch(session.role) {
      case UserRole.STORE_MANAGER:
        const v = venues.find(v => v.id === session.venueId);
        title = v ? v.name : "Local";
        Content = <StoreView venueId={session.venueId!} venueName={v?.name || ''} />;
        break;
      case UserRole.WAREHOUSE:
        title = "Panel de Almacén";
        Content = <WarehouseView />;
        break;
      case UserRole.ADMIN:
        title = "Administración";
        Content = <AdminView />;
        break;
      case UserRole.WEBMASTER:
        title = "Configuración del Sistema";
        Content = <WebmasterView />;
        break;
      default:
        Content = <div>Error de rol</div>;
    }

    return (
      <Layout role={session.role} onLogout={handleLogout} title={title} theme={theme} toggleTheme={toggleTheme}>
        {Content}
      </Layout>
    );
  }

  const filteredVenues = venues.filter(v => 
    isAdminUnlocked || v.name.toUpperCase() !== 'PRUEBAS'
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 transition-colors duration-300">
        {!effectiveLockMode && (
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1">
          <button 
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${loginMode === 'store' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
            onClick={() => { setLoginMode('store'); setError(''); setPasscodeInput(''); }}
          >
            <ShoppingCart size={18} /> Locales
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${loginMode === 'warehouse' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
            onClick={() => { setLoginMode('warehouse'); setError(''); setPasscodeInput(''); }}
          >
            <Truck size={18} /> Almacén
          </button>
          {isAdminUnlocked && (
            <button 
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${loginMode === 'admin' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
              onClick={() => { setLoginMode('admin'); setError(''); setPasscodeInput(''); }}
            >
              <LayoutDashboard size={18} /> Admin
            </button>
          )}
        </div>
        )}

        <div className="p-8">
          <div className="mb-6 text-center">
            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-[0.3em] mb-1 block">Believe Group</span>
            <div className="flex justify-between items-start text-left">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">Gestión de Almacén</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                    {loginMode === 'store' && "Acceso para Locales"}
                    {loginMode === 'warehouse' && "Acceso de Almacén"}
                    {loginMode === 'admin' && (customTitle || "Panel Administrativo")}
                  </p>
                </div>
                <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-yellow-300">
                   {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginMode === 'store' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seleccionar Local</label>
                {filteredVenues.length > 0 ? (
                  <select 
                    className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
                    value={selectedVenue}
                    onChange={(e) => setSelectedVenue(e.target.value)}
                    required
                  >
                    <option value="">-- Elegir --</option>
                    {filteredVenues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className={`text-center p-3 rounded-lg text-sm border flex flex-col items-center gap-2 ${permissionError ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'}`}>
                     {permissionError ? <AlertCircle className="w-6 h-6 text-red-500" /> : <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />}
                     {permissionError ? (
                        <div className="space-y-1">
                          <p className="font-bold">Error de Configuración</p>
                          <p className="text-[11px] leading-snug">Tus <strong>Reglas de la base de datos</strong> bloquean el acceso.</p>
                        </div>
                     ) : (
                        <div className="space-y-2">
                          <p>Cargando locales de Believe Group...</p>
                        </div>
                     )}
                  </div>
                )}
              </div>
            )}
            {loginMode === 'admin' && showAdminPassword && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña Maestro</label>
                <input 
                  type="password"
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                  placeholder="********"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>
            )}
            
            {isPasscodeNeeded() ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de Acceso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input 
                    type="password"
                    maxLength={4} 
                    pattern="[0-9]*"
                    inputMode="numeric"
                    className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 pl-10 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg tracking-widest"
                    placeholder="••••"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-center gap-3">
                <Unlock className="text-emerald-500" size={20} />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Acceso Abierto (Sin PIN)</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs rounded-lg text-center font-medium border border-red-100 dark:border-red-900">
                {error}
              </div>
            )}
            <button 
              type="submit" 
              className={`w-full py-3 rounded-lg text-white font-bold shadow-lg flex justify-center items-center gap-2 transform active:scale-95 transition-all
                ${loginMode === 'store' ? 'bg-brand-600 hover:bg-brand-700' : 
                  loginMode === 'warehouse' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'}
              `}
            >
              Ingresar <ArrowRight size={18} />
            </button>
          </form>
          
          {permissionError && (
             <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-[10px] text-blue-700 dark:text-blue-300 leading-tight">
                   <strong>Guía de ayuda:</strong> Revisa el archivo README.md para obtener el código de reglas global simplificado y habilitar el acceso.
                </div>
             </div>
          )}
        </div>
      </div>
      
      <div 
        onClick={!effectiveLockMode ? handleSecretClick : undefined}
        className="fixed bottom-4 left-4 text-slate-500 dark:text-slate-600 text-[10px] select-none hover:text-slate-400 transition-colors cursor-pointer flex items-center gap-1"
      >
         Believe Group V4.0 P {isAdminUnlocked ? <ShieldCheck className="w-3 h-3 text-green-500" /> : ''}
      </div>
    </div>
  );
}
