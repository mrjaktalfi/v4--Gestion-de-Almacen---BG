
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Venue, Order } from '../types';
import { subscribeToSettings, subscribeToVenues, updateSettings, addVenue, deleteVenue, updateVenue, exportAllData, getSettings, injectDataToFirestore, clearPrintQueue, addPrintJob, getAnyOrder } from '../services/dbService';
import { Save, Plus, Trash2, Edit2, X, DownloadCloud, AlertCircle, Database, RefreshCw, CheckCircle2, Printer, Layout, Monitor, ShieldCheck, Cloud, Server, Upload, Palette, Trash, PlayCircle, Lock, Key, Eye, EyeOff, ToggleLeft, ToggleRight, Image as ImageIcon, UploadCloud } from 'lucide-react';

export const WebmasterView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  
  const [formSettings, setFormSettings] = useState<AppSettings | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isSavingPasscodes, setIsSavingPasscodes] = useState(false);
  
  const [visiblePasscodes, setVisiblePasscodes] = useState<Record<string, boolean>>({
    admin: false,
    warehouse: false,
    store: false,
    webmaster: false
  });

  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueColor, setNewVenueColor] = useState('#8b5cf6');
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string, name: string}>({ show: false, id: '', name: '' });
  
  const [isExporting, setIsExporting] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    testConnection();
    const unsubSettings = subscribeToSettings((data) => {
        setSettings(data);
        if (!formSettings) setFormSettings(data);
    });
    const unsubVenues = subscribeToVenues(setVenues);
    return () => {
        unsubSettings();
        unsubVenues();
    };
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      await getSettings();
      setConnectionStatus('success');
    } catch (e: any) {
      setConnectionStatus('error');
    }
  };

  const togglePasscodeVisibility = (key: string) => {
    setVisiblePasscodes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestPrint = async () => {
    if (!formSettings) return;
    setIsTestPrinting(true);
    try {
      let dummyOrder: Order | null = await getAnyOrder();
      
      if (!dummyOrder) {
        // Fallback if no orders exist, but this might fail validation
        dummyOrder = {
          id: "TEST-PRINT-JOB",
          venueId: "test",
          venueName: "LOCAL DE PRUEBA",
          items: [{ productId: "test", quantity: 1, productName: "TEST PRODUCT", productImage: "" }],
          type: 'request',
          status: 'pending',
          timestamp: Date.now()
        };
      } else {
        // Override items to show it's a test print, but keep valid ID
        dummyOrder = {
            ...dummyOrder,
            items: [{ productId: "test", quantity: 1, productName: "TEST PRODUCT (ID REAL)", productImage: "" }]
        };
      }

      await addPrintJob(dummyOrder, formSettings);
      alert("Trabajo de prueba enviado a Cloud. El ESP32 debería detectarlo ahora.");
    } catch (e) {
      console.error(e);
      alert("Error en test print. Ver consola.");
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (formSettings) {
      setIsSavingPasscodes(true);
      try {
        await updateSettings(formSettings);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      } catch (e) {
        alert("Error al guardar.");
      } finally {
        setIsSavingPasscodes(false);
      }
    }
  };

  const handleAddVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName) return;
    try {
      await addVenue(newVenueName, newVenueColor);
      setNewVenueName('');
      setNewVenueColor('#8b5cf6');
    } catch (err) {
      alert("Error al añadir local.");
    }
  };

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;
    try {
      await updateVenue(editingVenue.id, {
        name: editingVenue.name,
        color: editingVenue.color
      });
      setEditingVenue(null);
    } catch (err) {
      alert("Error al actualizar local.");
    }
  };

  const handleDeleteVenue = async () => {
    try {
      await deleteVenue(deleteConfirm.id);
      setDeleteConfirm({ show: false, id: '', name: '' });
    } catch (err) {
      alert("Error al eliminar local.");
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `believe_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (e) {
      alert("Error al exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleInjectData = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("¿Inyectar datos? Esto sobrescribirá documentos existentes.")) return;
      
      setIsInjecting(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              await injectDataToFirestore(data);
              alert("Datos inyectados con éxito.");
              window.location.reload();
          } catch (err) {
              alert("Error al inyectar datos: " + (err as Error).message);
          } finally {
              setIsInjecting(false);
          }
      };
      reader.readAsText(file);
  };

  const handleClearPrintQueue = async () => {
    if (!confirm("¿Vaciar cola de impresión? Esto eliminará todos los registros de tickets pendientes e impresos.")) return;
    setIsClearingQueue(true);
    try {
      await clearPrintQueue();
      alert("Cola de impresión vaciada.");
    } catch (e) {
      alert("Error al vaciar cola.");
    } finally {
      setIsClearingQueue(false);
    }
  };

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (optional, but good for base64 storage in firestore)
    if (file.size > 100 * 1024) { // 100kb limit
      alert("El archivo es demasiado grande. Por favor, usa una imagen menor a 100kb para el favicon.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (formSettings) {
        setFormSettings({ ...formSettings, favicon: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const ToggleSwitch = ({ enabled, onChange, color }: { enabled: boolean, onChange: (v: boolean) => void, color: string }) => (
    <button 
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors outline-none ${enabled ? color : 'bg-slate-300 dark:bg-slate-700'}`}
    >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5.5' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="space-y-8 pb-20">
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <CheckCircle2 size={24} />
            <span className="font-bold">Configuración guardada correctamente</span>
          </div>
        </div>
      )}

      <div className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
        connectionStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400' :
        connectionStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400' :
        'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
      }`}>
        <div className="flex items-center gap-3">
          {connectionStatus === 'testing' ? <RefreshCw className="animate-spin" size={20} /> : 
           connectionStatus === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm uppercase tracking-wider">
            {connectionStatus === 'testing' ? 'Verificando enlace con la base de datos...' :
             connectionStatus === 'success' ? 'Sincronización Activa con PocketBase' : 'Error de Conexión'}
          </span>
        </div>
        <button onClick={testConnection} className="p-2 hover:bg-black/5 rounded-full transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* MANTENIMIENTO */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border dark:border-slate-800 space-y-4">
             <div className="flex items-center gap-2 text-gray-800 dark:text-white font-bold border-b dark:border-slate-800 pb-4">
                <Database size={20} className="text-blue-500" />
                <span>Mantenimiento</span>
             </div>
             <button onClick={handleExportData} disabled={isExporting} className="w-full py-3 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                {isExporting ? <RefreshCw className="animate-spin" /> : <DownloadCloud size={18} />}
                Exportar JSON Backup
             </button>
             <button onClick={() => fileInputRef.current?.click()} disabled={isInjecting} className="w-full py-3 px-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors">
                {isInjecting ? <RefreshCw className="animate-spin" /> : <Upload size={18} />}
                Inyectar Datos JSON
             </button>
             <button onClick={handleClearPrintQueue} disabled={isClearingQueue} className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                {isClearingQueue ? <RefreshCw className="animate-spin" /> : <Trash size={18} />}
                Vaciar Cola de Impresión
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleInjectData} />
          </div>

          {/* FAVICON PERSONALIZATION */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border dark:border-slate-800 space-y-4">
             <div className="flex items-center gap-2 text-gray-800 dark:text-white font-bold border-b dark:border-slate-800 pb-4">
                <ImageIcon size={20} className="text-brand-500" />
                <span>Personalización App</span>
             </div>
             <div className="space-y-4">
                <div className="flex flex-col gap-4">
                   <div className="flex items-center gap-4">
                      <div 
                         onClick={() => faviconInputRef.current?.click()}
                         className="w-16 h-16 bg-slate-100 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-brand-500 group transition-all relative"
                      >
                         {formSettings?.favicon ? <img src={formSettings.favicon} alt="Favicon Preview" className="w-10 h-10 object-contain" /> : <ImageIcon size={24} className="text-slate-400" />}
                         <div className="absolute inset-0 bg-brand-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <UploadCloud size={20} className="text-brand-600" />
                         </div>
                      </div>
                      <div className="flex-1">
                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Previsualización de Icono</p>
                         <p className="text-[9px] text-slate-400 mt-1">Sube un archivo PNG, ICO o SVG para el icono del navegador.</p>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Origen del Favicon</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-3 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                          placeholder="URL de imagen o pega Base64"
                          value={formSettings?.favicon || ''}
                          onChange={e => setFormSettings(prev => prev ? {...prev, favicon: e.target.value} : null)}
                        />
                      </div>
                   </div>

                   <button 
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2"
                   >
                      <UploadCloud size={16} /> Subir Archivo Icono
                   </button>
                   
                   <input 
                      type="file" 
                      ref={faviconInputRef} 
                      className="hidden" 
                      accept="image/png, image/jpeg, image/x-icon, image/svg+xml" 
                      onChange={handleFaviconFileChange} 
                   />
                </div>
                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-2 mt-4"
                >
                  <Save size={16} /> Aplicar Favicon
                </button>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {/* PASSCODES SECTION */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-gray-800 dark:text-white font-bold">
                <Lock size={20} className="text-red-500" />
                <span>Control de Accesos (Passcodes)</span>
              </div>
              <button 
                onClick={handleSaveSettings}
                disabled={isSavingPasscodes}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSavingPasscodes ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                Guardar Accesos
              </button>
            </div>
            {formSettings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {/* Admin */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Pin Administrador</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{formSettings.adminPasscodeEnabled ? 'ON' : 'OFF'}</span>
                      <ToggleSwitch color="bg-red-500" enabled={formSettings.adminPasscodeEnabled} onChange={v => setFormSettings({...formSettings, adminPasscodeEnabled: v})} />
                    </div>
                  </div>
                  <div className={`relative transition-all ${formSettings.adminPasscodeEnabled ? 'opacity-100' : 'opacity-40'}`}>
                    <Key className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                      type={visiblePasscodes.admin ? "text" : "password"} 
                      maxLength={4}
                      disabled={!formSettings.adminPasscodeEnabled}
                      className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-3 pl-10 pr-12 rounded-xl dark:text-white font-mono text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      value={formSettings.adminPasscode}
                      onChange={e => setFormSettings({...formSettings, adminPasscode: e.target.value})}
                    />
                    <button 
                      type="button"
                      disabled={!formSettings.adminPasscodeEnabled}
                      onClick={() => togglePasscodeVisibility('admin')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      {visiblePasscodes.admin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {!formSettings.adminPasscodeEnabled && <p className="text-[9px] text-red-500 font-bold text-center uppercase tracking-wider">Acceso Abierto (Sin PIN)</p>}
                </div>

                {/* Warehouse */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Pin Almacén</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{formSettings.warehousePasscodeEnabled ? 'ON' : 'OFF'}</span>
                      <ToggleSwitch color="bg-blue-500" enabled={formSettings.warehousePasscodeEnabled} onChange={v => setFormSettings({...formSettings, warehousePasscodeEnabled: v})} />
                    </div>
                  </div>
                  <div className={`relative transition-all ${formSettings.warehousePasscodeEnabled ? 'opacity-100' : 'opacity-40'}`}>
                    <Key className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                      type={visiblePasscodes.warehouse ? "text" : "password"} 
                      maxLength={4}
                      disabled={!formSettings.warehousePasscodeEnabled}
                      className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-3 pl-10 pr-12 rounded-xl dark:text-white font-mono text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={formSettings.warehousePasscode}
                      onChange={e => setFormSettings({...formSettings, warehousePasscode: e.target.value})}
                    />
                    <button 
                      type="button"
                      disabled={!formSettings.warehousePasscodeEnabled}
                      onClick={() => togglePasscodeVisibility('warehouse')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      {visiblePasscodes.warehouse ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {!formSettings.warehousePasscodeEnabled && <p className="text-[9px] text-blue-500 font-bold text-center uppercase tracking-wider">Acceso Abierto (Sin PIN)</p>}
                </div>

                {/* Stores */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Pin Locales</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{formSettings.storePasscodeEnabled ? 'ON' : 'OFF'}</span>
                      <ToggleSwitch color="bg-emerald-500" enabled={formSettings.storePasscodeEnabled} onChange={v => setFormSettings({...formSettings, storePasscodeEnabled: v})} />
                    </div>
                  </div>
                  <div className={`relative transition-all ${formSettings.storePasscodeEnabled ? 'opacity-100' : 'opacity-40'}`}>
                    <Key className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                      type={visiblePasscodes.store ? "text" : "password"} 
                      maxLength={4}
                      disabled={!formSettings.storePasscodeEnabled}
                      className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-3 pl-10 pr-12 rounded-xl dark:text-white font-mono text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      value={formSettings.storePasscode}
                      onChange={e => setFormSettings({...formSettings, storePasscode: e.target.value})}
                    />
                    <button 
                      type="button"
                      disabled={!formSettings.storePasscodeEnabled}
                      onClick={() => togglePasscodeVisibility('store')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      {visiblePasscodes.store ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {!formSettings.storePasscodeEnabled && <p className="text-[9px] text-emerald-500 font-bold text-center uppercase tracking-wider">Acceso Abierto (Sin PIN)</p>}
                </div>

                {/* Webmaster */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Pin Webmaster</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{formSettings.webmasterPasscodeEnabled ? 'ON' : 'OFF'}</span>
                      <ToggleSwitch color="bg-purple-500" enabled={formSettings.webmasterPasscodeEnabled} onChange={v => setFormSettings({...formSettings, webmasterPasscodeEnabled: v})} />
                    </div>
                  </div>
                  <div className={`relative transition-all ${formSettings.webmasterPasscodeEnabled ? 'opacity-100' : 'opacity-40'}`}>
                    <Key className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                      type={visiblePasscodes.webmaster ? "text" : "password"} 
                      maxLength={4}
                      disabled={!formSettings.webmasterPasscodeEnabled}
                      className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-3 pl-10 pr-12 rounded-xl dark:text-white font-mono text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      value={formSettings.webmasterPasscode}
                      onChange={e => setFormSettings({...formSettings, webmasterPasscode: e.target.value})}
                    />
                    <button 
                      type="button"
                      disabled={!formSettings.webmasterPasscodeEnabled}
                      onClick={() => togglePasscodeVisibility('webmaster')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      {visiblePasscodes.webmaster ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {!formSettings.webmasterPasscodeEnabled && <p className="text-[9px] text-purple-500 font-bold text-center uppercase tracking-wider">Acceso Abierto (Sin PIN)</p>}
                </div>
              </div>
            )}
          </div>
          
          {/* PRINTER SECTION */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white">
                <Printer className="text-purple-500" />
                <h2 className="text-xl font-bold tracking-tight">Impresora ITP-81+</h2>
              </div>
              {formSettings && (
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${formSettings.printerType === 'network' ? 'bg-purple-900/40 border-purple-500 text-purple-400' : 'bg-blue-900/40 border-blue-500 text-blue-400'}`}>
                   {formSettings.printerType === 'network' ? 'Modo Cloud' : 'Modo Navegador'}
                </div>
              )}
            </div>

            {formSettings && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Método de Conectividad</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setFormSettings({...formSettings, printerType: 'browser'})}
                                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${formSettings.printerType === 'browser' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                            >
                                <Monitor size={28} />
                                <span className="font-black text-xs uppercase">Navegador</span>
                            </button>
                            <button 
                                onClick={() => setFormSettings({...formSettings, printerType: 'network'})}
                                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${formSettings.printerType === 'network' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                            >
                                <Cloud size={28} />
                                <span className="font-black text-xs uppercase">Cloud ESP32</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-center gap-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <p className="text-xs text-slate-400 leading-relaxed italic">
                              {formSettings.printerType === 'network' 
                                  ? "Envía los tickets a la cola de PocketBase. El ESP32 los detecta por Cloud." 
                                  : "Abre el diálogo de impresión del navegador."}
                          </p>
                        </div>
                        
                        {formSettings.printerType === 'network' && (
                          <button 
                            onClick={handleTestPrint} 
                            disabled={isTestPrinting}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                          >
                            {isTestPrinting ? <RefreshCw className="animate-spin" size={14} /> : <PlayCircle size={14} />}
                            ENVIAR IMPRESIÓN DE PRUEBA
                          </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">IP Local Impresora</label>
                        <input type="text" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl text-sm font-mono focus:border-blue-500 outline-none" value={formSettings.printerIP} onChange={e => setFormSettings({...formSettings, printerIP: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Título en el Ticket</label>
                        <input type="text" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl text-sm focus:border-purple-500 outline-none" value={formSettings.printerTitle} onChange={e => setFormSettings({...formSettings, printerTitle: e.target.value})} />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button onClick={handleSaveSettings} className="bg-white text-black font-black px-10 py-4 rounded-2xl shadow-xl flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95">
                        <Save size={20} /> GUARDAR PREFERENCIAS
                    </button>
                </div>
              </div>
            )}
          </div>

          {/* VENUES SECTION */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border dark:border-slate-800">
            <div className="flex items-center gap-2 mb-6 text-gray-800 dark:text-white border-b dark:border-slate-800 pb-4">
              <Layout className="text-emerald-500" />
              <h2 className="text-lg font-bold">Gestión de Locales (Venues)</h2>
            </div>
            
            <form onSubmit={handleAddVenue} className="flex flex-col sm:flex-row gap-4 mb-8 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-800">
              <div className="flex-1 flex gap-2">
                <input 
                  type="color" 
                  className="w-12 h-12 rounded-xl border-none cursor-pointer bg-transparent"
                  value={newVenueColor}
                  onChange={e => setNewVenueColor(e.target.value)}
                />
                <input 
                  type="text" 
                  className="flex-1 bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" 
                  placeholder="Nombre del Local" 
                  value={newVenueName} 
                  onChange={e => setNewVenueName(e.target.value)} 
                />
              </div>
              <button type="submit" className="bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95">
                <Plus size={20}/> Añadir
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {venues.map(v => (
                <div key={v.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center group">
                   <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: v.color }}></div>
                      <span className="font-bold text-slate-800 dark:text-white">{v.name}</span>
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingVenue(v)} className="p-2 text-slate-400 hover:text-blue-500"><Edit2 size={18}/></button>
                      <button onClick={() => setDeleteConfirm({ show: true, id: v.id, name: v.name })} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR LOCAL */}
      {editingVenue && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border dark:border-slate-800">
              <h3 className="text-xl font-black dark:text-white uppercase mb-6">Editar Local</h3>
              <form onSubmit={handleUpdateVenue} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Nombre</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 p-4 rounded-2xl dark:text-white outline-none"
                      value={editingVenue.name}
                      onChange={e => setEditingVenue({...editingVenue, name: e.target.value})}
                      required
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Color</label>
                    <input 
                      type="color" 
                      className="w-full h-14 rounded-2xl border-none cursor-pointer bg-transparent"
                      value={editingVenue.color}
                      onChange={e => setEditingVenue({...editingVenue, color: e.target.value})}
                    />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingVenue(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-2xl font-bold">Cancelar</button>
                    <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">Guardar</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL ELIMINAR LOCAL */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-sm text-center shadow-2xl border dark:border-slate-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-black mb-2 dark:text-white uppercase">¿Eliminar {deleteConfirm.name}?</h3>
            <p className="text-slate-500 mb-8">Esta acción es irreversible.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm({show: false, id: '', name: ''})} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-2xl font-bold">Cancelar</button>
              <button onClick={handleDeleteVenue} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
