
import React, { useState, useEffect, useRef } from 'react';
import { Order, AppSettings, PrintJob } from '../types';
import { 
  subscribeToPendingOrders, 
  subscribeToRecentProcessed, 
  processOrder, 
  getSettings, 
  getFullHistoryOrders, 
  subscribeToSettings,
  receiveOrder,
  addPrintJob,
  subscribeToPrintJob,
  subscribeToPrintQueue,
  clearPrintQueue
} from '../services/dbService';
import { Check, Clock, Package, History, X, Search, RotateCw, RotateCcw, Truck, Loader2, Send, Monitor, Wifi, Cloud, CheckCircle2, AlertCircle, Terminal, Trash2, Printer, Hash, Plus, Volume2, VolumeX, BellRing } from 'lucide-react';

export const WarehouseView: React.FC = () => {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [processedOrders, setProcessedOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<{[key: string]: 'pending' | 'printed' | 'error' | null}>({});
  const [recentJobs, setRecentJobs] = useState<PrintJob[]>([]);
  const [showCloudMonitor, setShowCloudMonitor] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [recentLimit, setRecentLimit] = useState(5);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  
  const [showHistory, setShowHistory] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const printTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect for static subscriptions (Pending Orders & Settings)
  useEffect(() => {
    const unsubPending = subscribeToPendingOrders((data) => {
      setPendingOrders(data);
      setLoading(false);
    });
    const unsubSettings = subscribeToSettings(setSettings);

    return () => {
      unsubPending();
      unsubSettings();
      if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
    };
  }, []);

  // Effect for Recent Processed Orders (depends on recentLimit)
  useEffect(() => {
    const unsubRecent = subscribeToRecentProcessed((data) => {
       setProcessedOrders(data);
    }, recentLimit);

    return () => {
      unsubRecent();
    };
  }, [recentLimit]);

  // Effect for Print Queue (only when Cloud Monitor is open)
  useEffect(() => {
    if (!showCloudMonitor) return;

    const unsub = subscribeToPrintQueue((data) => {
      setRecentJobs(data);
    });

    return () => {
      unsub();
    };
  }, [showCloudMonitor]);

  // Effect for Alarm Sound (Option B) + Wake Lock + Media Session
  useEffect(() => {
    // Initialize audio with a persistent alarm sound
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.loop = true;
    }

    // Media Session API to help background playback
    if ('mediaSession' in navigator && audioRef.current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Alarma de Pedidos',
        artist: 'Believe Group',
        album: 'Gestión de Almacén',
        artwork: [
          { src: 'https://picsum.photos/seed/warehouse/512/512', sizes: '512x512', type: 'image/png' }
        ]
      });
    }

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock activo: La pantalla no se apagará');
        } catch (err) {
          console.warn('Wake Lock falló:', err);
        }
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    if (isSoundEnabled && pendingOrders.length > 0 && !selectedOrder) {
      requestWakeLock();
      audioRef.current.play().catch(err => {
        console.warn("Autoplay blocked or audio error:", err);
      });
    } else {
      releaseWakeLock();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    // Re-request wake lock if tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSoundEnabled && pendingOrders.length > 0 && !selectedOrder) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isSoundEnabled, pendingOrders.length, selectedOrder]);

  const handleProcessOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(orderId);
    try {
      await processOrder(orderId, 'warehouse_staff_current');
      setSelectedOrder(null);
    } catch (e) {
      alert("Error al procesar: " + (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrint = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!settings) return;

    setPrintingId(order.id);
    setPrintStatus(prev => ({ ...prev, [order.id]: 'pending' }));
    
    try {
        if (order.status === 'pending') {
            await receiveOrder(order.id);
        }

        if (settings.printerType === 'network') {
            const jobId = await addPrintJob(order, settings);
            
            const unsub = subscribeToPrintJob(jobId, (status) => {
                if (status === 'printed') {
                    if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
                    setPrintStatus(prev => ({ ...prev, [order.id]: 'printed' }));
                    setPrintingId(null);
                    setTimeout(() => setPrintStatus(prev => ({ ...prev, [order.id]: null })), 5000);
                    unsub();
                }
            });

            printTimeoutRef.current = setTimeout(() => {
                setPrintingId(null);
                setPrintStatus(prev => ({ ...prev, [order.id]: 'error' }));
                unsub();
            }, 30000);
        } else {
            setPrintingId(null);
        }
    } catch (err) {
        setPrintingId(null);
        setPrintStatus(prev => ({ ...prev, [order.id]: 'error' }));
    }
  };

  const handleClearQueue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("¿Estás seguro de que quieres limpiar todo el monitor de impresión?")) {
      setIsClearing(true);
      try {
        await clearPrintQueue();
        alert("Monitor de impresión limpiado con éxito.");
      } catch (err) {
        alert("Error al limpiar la cola: " + (err as Error).message);
      } finally {
        setIsClearing(false);
      }
    }
  };

  if (loading) return <div className="dark:text-white p-6 text-center">Cargando almacén...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
        <h2 className="text-xl font-black dark:text-white flex items-center gap-2 uppercase tracking-tight">
          <Package className="text-brand-500" /> Control de Stock
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSoundEnabled ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
          >
            {isSoundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {isSoundEnabled ? 'Alarma Activa' : 'Activar Sonido'}
          </button>
          <button 
            onClick={() => setShowCloudMonitor(!showCloudMonitor)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showCloudMonitor ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
          >
            <Terminal size={14} /> {showCloudMonitor ? 'Cerrar Monitor' : 'Monitor ESP32'}
          </button>
        </div>
      </div>

      {showCloudMonitor && (
        <div className="bg-slate-950 rounded-2xl p-5 border border-purple-500/30 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest">
              <Cpu size={14} className="animate-pulse" /> Estado de la Cola Cloud
            </div>
            <button 
              onClick={handleClearQueue} 
              disabled={isClearing}
              className={`p-2 transition-all rounded-lg ${isClearing ? 'opacity-50 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-red-400/10 active:scale-95'}`}
              title="Limpiar cola de impresión"
            >
              {isClearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          </div>
          <div className="space-y-2">
            {recentJobs.length === 0 && <p className="text-slate-600 text-[10px] italic py-2 text-center">No hay trabajos recientes en la cola.</p>}
            {recentJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${job.status === 'printed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`}></div>
                  <span className="text-[10px] font-mono text-slate-400">#{job.orderIdShort}</span>
                  <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">{job.venue}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[9px] text-slate-500">{job.timeStr}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${job.status === 'printed' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
                    {job.status === 'printed' ? 'Impreso' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[9px] text-slate-600 flex items-center gap-2">
            <Info size={10} /> El ESP32 comprueba esta cola cada 5 segundos automáticamente.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} /> Pendientes de Preparar
          </h3>
          {pendingOrders.map(order => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrder(order)}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-l-8 overflow-hidden group hover:shadow-md transition-all cursor-pointer relative dark:border-r dark:border-t dark:border-b dark:border-slate-700"
              style={{ borderLeftColor: order.type === 'return' ? '#f59e0b' : order.venueColor }}
            >
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tight">{order.venueName}</h4>
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Hash size={10} /> {order.id.slice(-6)} • {new Date(order.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${order.type === 'return' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {order.type === 'return' ? 'Devolución' : 'Pedido'}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                   {order.status === 'preparing' && (
                     <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-3 py-1 rounded-lg uppercase flex items-center gap-1">
                        <CheckCircle2 size={10} /> Ya Impreso / Preparando
                     </div>
                   )}
                </div>
              </div>
            </div>
          ))}
          {pendingOrders.length === 0 && (
            <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
               <Package size={40} className="mx-auto text-slate-300 mb-2" />
               <p className="text-slate-500 font-bold uppercase text-xs">Sin tareas pendientes</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <History size={16} /> Entregas Recientes
          </h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border dark:border-slate-700">
            {processedOrders.map(order => (
              <div key={order.id} onClick={() => setSelectedOrder(order)} className="p-4 border-b dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ backgroundColor: order.venueColor }}></div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white block leading-none">{order.venueName}</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">ID: {order.id.slice(-6)}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    {new Date(order.processedAt || 0).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
                    {new Date(order.processedAt || 0).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {processedOrders.length >= recentLimit && recentLimit < 20 && (
              <button 
                onClick={() => setRecentLimit(prev => Math.min(prev + 5, 20))}
                className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              >
                <Plus size={12} /> Cargar más entregas
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className={`p-6 flex justify-between items-center border-b dark:border-slate-700 ${selectedOrder.type === 'return' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
              <div>
                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight leading-none">{selectedOrder.venueName}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                  {selectedOrder.status === 'processed' || selectedOrder.status === 'delivered' 
                    ? 'Pedido Finalizado' 
                    : (selectedOrder.type === 'return' ? 'Recepción de Devolución' : 'Preparación de Pedido')}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform">
                <X size={24} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-800 dark:text-white">{item.productName}</span>
                    <span className="text-2xl font-black text-brand-600 dark:text-brand-400">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 space-y-4">
                <div className={`grid gap-4 ${selectedOrder.status === 'processed' || selectedOrder.status === 'delivered' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <button 
                    onClick={() => handlePrint(selectedOrder)}
                    disabled={printingId === selectedOrder.id}
                    className={`py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${
                      printStatus[selectedOrder.id] === 'printed' ? 'bg-emerald-600 text-white' :
                      printStatus[selectedOrder.id] === 'error' ? 'bg-red-600 text-white' :
                      printingId === selectedOrder.id ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 dark:bg-white dark:text-black text-white'
                    }`}
                  >
                    {printingId === selectedOrder.id ? <Loader2 className="animate-spin" /> : <Printer size={20} />}
                    {printStatus[selectedOrder.id] === 'printed' ? 'RE-IMPRIMIR' : 'IMPRIMIR TICKET'}
                  </button>

                  {!(selectedOrder.status === 'processed' || selectedOrder.status === 'delivered') && (
                    <button 
                      onClick={(e) => handleProcessOrder(selectedOrder.id, e)} 
                      disabled={processingId === selectedOrder.id}
                      className="py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                    >
                      {processingId === selectedOrder.id ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                      MARCAR FINALIZADO
                    </button>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Cpu = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <path d="M9 9h6v6H9z" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" />
  </svg>
);

const Info = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);
