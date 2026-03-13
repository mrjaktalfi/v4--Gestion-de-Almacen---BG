
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CartItem, Order, Category, Venue } from '../types';
import { subscribeToCategories, createOrder, subscribeToProducts, subscribeToVenueOrders } from '../services/dbService';
import { ShoppingCart, Plus, Minus, History, Package, Search, Eye, X, Calendar, Hash, ArrowLeftRight, Truck, RotateCcw, Bell, CheckCircle2, Clock, AlertCircle, Send } from 'lucide-react';

interface StoreViewProps {
  venueId: string;
  venueName: string;
}

export const StoreView: React.FC<StoreViewProps> = ({ venueId, venueName }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [orderType, setOrderType] = useState<'request' | 'return'>('request');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Sistema de Notificaciones mejorado con tipo de pedido
  const [activeNotification, setActiveNotification] = useState<{ id: string, status: string, type: 'request' | 'return', timestamp: number } | null>(null);
  const previousOrdersRef = useRef<Map<string, string>>(new Map());
  const acknowledgedNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubCategories = subscribeToCategories(setCategories);
    const unsubProducts = subscribeToProducts((data) => {
      setProducts(data);
      setLoading(false);
    });
    
    const unsubOrders = subscribeToVenueOrders(venueId, (data) => {
      // Solo revisamos cambios si ya teníamos datos previos
      if (previousOrdersRef.current.size > 0) {
          data.forEach(order => {
              const oldStatus = previousOrdersRef.current.get(order.id);
              if (oldStatus && oldStatus !== order.status) {
                  const notificationId = `${order.id}-${order.status}`;
                  if (!acknowledgedNotifications.current.has(notificationId)) {
                      // Notificamos cambios a preparing o processed
                      if (order.status === 'preparing' || order.status === 'processed') {
                          setActiveNotification({ 
                            id: order.id, 
                            status: order.status, 
                            type: order.type,
                            timestamp: Date.now() 
                          });
                          acknowledgedNotifications.current.add(notificationId);
                      }
                  }
              }
          });
      }
      
      // Actualizar mapa de estados previos
      const newMap = new Map<string, string>();
      data.forEach(o => newMap.set(o.id, o.status));
      previousOrdersRef.current = newMap;
      
      setOrderHistory(data);
    });

    return () => {
      unsubCategories();
      unsubProducts();
      unsubOrders();
    };
  }, [venueId]);

  const availableProducts = useMemo(() => {
    return products.filter(p => {
      const isTestProduct = p.name.includes("000000 - PRODUCTO DE PRUEBA");
      const isTestVenue = venueName.toUpperCase() === 'PRUEBAS';
      
      if (isTestProduct && !isTestVenue) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory, venueName]);

  const addToCart = (product: Product) => {
    if (orderType === 'request') {
      const available = product.current_stock - product.reserved_stock;
      const currentInCart = cart.find(i => i.productId === product.id)?.quantity || 0;
      if (currentInCart >= available) return;
    }
    
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, quantity: 1, productName: product.name, productImage: product.image }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.productId !== productId);
    });
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await createOrder(venueId, cart.map(i => ({ productId: i.productId, quantity: i.quantity })), orderType);
      setActiveNotification({ id: 'new', status: 'pending', type: orderType, timestamp: Date.now() });
      setCart([]);
      setActiveTab('history');
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductStockStatus = (p: Product) => {
    if (orderType === 'return') return { label: '', color: '', disabled: false };
    const available = p.current_stock - p.reserved_stock;
    if (available <= 0) return { label: 'Agotado', color: 'text-red-500 dark:text-red-400', disabled: true };
    if (available < p.threshold_low_stock) return { label: `${available} disp.`, color: 'text-orange-500 dark:text-orange-400', disabled: false };
    return { label: `${available} disp.`, color: 'text-green-600 dark:text-green-400', disabled: false };
  };

  const getNotificationStyles = () => {
    if (!activeNotification) return null;
    const isReturn = activeNotification.type === 'return';

    switch(activeNotification.status) {
      case 'pending': 
        return { 
          border: 'border-red-500', 
          bg: 'bg-red-500', 
          overlay: 'bg-red-950/70', 
          icon: isReturn ? <RotateCcw size={48} /> : <Send size={48} />, 
          iconBg: 'bg-red-100 text-red-600',
          title: isReturn ? '¡DEVOLUCIÓN ENVIADA!' : '¡PEDIDO ENVIADO!',
          desc: isReturn 
            ? 'Has avisado al almacén que vas a devolver botellas. Llévalas cuando puedas.' 
            : 'Tu pedido ha sido enviado correctamente al almacén.'
        };
      case 'preparing': 
        return { 
          border: 'border-yellow-400', 
          bg: 'bg-yellow-500', 
          overlay: 'bg-yellow-950/70', 
          icon: <Clock size={48} />, 
          iconBg: 'bg-yellow-100 text-yellow-600',
          title: isReturn ? '¡PENDIENTE DE ENTREGA!' : '¡RECIBIDO Y PREPARANDO!',
          desc: isReturn 
            ? 'El almacén está a la espera de que el empleado entregue las botellas.' 
            : 'El almacén ha recibido tu pedido y está empezando a prepararlo.'
        };
      case 'processed': 
        return { 
          border: 'border-emerald-500', 
          bg: 'bg-emerald-600', 
          overlay: 'bg-emerald-950/70', 
          icon: <CheckCircle2 size={48} />, 
          iconBg: 'bg-emerald-100 text-emerald-600',
          title: isReturn ? '¡DEVOLUCIÓN RECIBIDA!' : '¡PEDIDO LISTO!',
          desc: isReturn 
            ? 'El almacén ha confirmado la entrada de las botellas correctamente.' 
            : 'Tu pedido ya está procesado y listo para ser recogido.'
        };
      default: return null;
    }
  };

  const notifStyles = getNotificationStyles();

  if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Conectando con inventario...</div>;

  return (
    <div className="space-y-6">
      {/* Sistema de Notificación Pop-up */}
      {activeNotification && notifStyles && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className={`absolute inset-0 ${notifStyles.overlay} backdrop-blur-md transition-colors`} onClick={() => setActiveNotification(null)}></div>
              <div className={`bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-[101] animate-in zoom-in-90 duration-300 flex flex-col items-center text-center p-8 border-[10px] ${notifStyles.border}`}>
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg ${notifStyles.iconBg}`}>
                      {notifStyles.icon}
                  </div>
                  
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 leading-tight uppercase tracking-tight">
                      {notifStyles.title}
                  </h2>
                  <p className="text-gray-700 dark:text-gray-200 text-xl font-bold mb-8 leading-relaxed">
                      {notifStyles.desc}
                  </p>
                  
                  <button 
                    onClick={() => setActiveNotification(null)}
                    className={`w-full py-5 rounded-2xl font-black text-2xl text-white shadow-xl transition-all active:scale-95 hover:brightness-110 ${notifStyles.bg}`}
                  >
                    ENTENDIDO
                  </button>
              </div>
          </div>
      )}

      {/* Tabs */}
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-2 px-4 font-medium text-sm transition-colors ${activeTab === 'catalog' ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Panel de Operaciones
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-4 font-medium text-sm transition-colors ${activeTab === 'history' ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Historial de Movimientos
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg mb-2">
            <button 
              onClick={() => { setOrderType('request'); setCart([]); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${orderType === 'request' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500'}`}
            >
              <Truck size={14} /> Pedir Botellas
            </button>
            <button 
              onClick={() => { setOrderType('return'); setCart([]); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${orderType === 'return' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500'}`}
            >
              <RotateCcw size={14} /> Devolver Botellas
            </button>
          </div>
        )}
      </div>

      {activeTab === 'catalog' && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm mb-4 flex flex-col sm:flex-row gap-4 sticky top-16 sm:top-20 z-20 border border-gray-100 dark:border-slate-700">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  className="pl-10 w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-md py-2 focus:ring-brand-500 focus:border-brand-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-md py-2 px-3 focus:ring-brand-500 focus:border-brand-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Todas las Categorías</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {availableProducts.map(product => {
                const status = getProductStockStatus(product);
                const inCart = cart.find(i => i.productId === product.id)?.quantity || 0;
                const available = product.current_stock - product.reserved_stock;
                
                return (
                  <div key={product.id} className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border-2 transition-colors flex flex-row overflow-hidden min-h-[160px] ${orderType === 'return' ? 'border-amber-100 dark:border-amber-900/30' : 'border-transparent'} ${status.disabled && orderType === 'request' ? 'opacity-60 grayscale' : ''}`}>
                    <div className="w-[35%] bg-gray-200 dark:bg-slate-700 relative flex-shrink-0">
                      <img src={product.image || undefined} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                    </div>

                    <div className="w-[65%] p-4 flex flex-col justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight mb-1 break-words">{product.name}</h3>
                        {status.label && (
                          <span className={`text-sm font-bold ${status.color} block`}>{status.label}</span>
                        )}
                      </div>
                      
                      <div className="flex justify-end items-end mt-2">
                         <div className={`flex items-center gap-3 p-1.5 rounded-full border ${orderType === 'return' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-slate-700/50'}`}>
                           {inCart > 0 && (
                              <>
                                <button onClick={() => removeFromCart(product.id)} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-white shadow-sm active:scale-95 transition-transform">
                                  <Minus size={20} />
                                </button>
                                <span className="font-bold text-lg min-w-[1rem] text-center text-gray-900 dark:text-white">{inCart}</span>
                              </>
                           )}
                           <button 
                              onClick={() => addToCart(product)} 
                              disabled={orderType === 'request' && (status.disabled || inCart >= available)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all shadow-sm active:scale-95 ${orderType === 'request' && (status.disabled || inCart >= available) ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed' : orderType === 'return' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                            >
                             <Plus size={20} />
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-4">
             <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg border-t-4 p-4 sticky top-24 z-10 ${orderType === 'return' ? 'border-amber-500' : 'border-brand-500'}`}>
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-slate-700 pb-2">
                  <ShoppingCart className={orderType === 'return' ? 'text-amber-600' : 'text-brand-600'} />
                  <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                    {orderType === 'return' ? 'Cesta de Devolución' : 'Resumen de Pedido'}
                  </h2>
                </div>
                
                {cart.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center italic">Agrega productos a la lista.</p>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.productId} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-200">
                        <span className="flex-1 truncate pr-2 font-medium">{item.productName}</span>
                        <div className="flex items-center gap-3">
                           <span className={`font-bold ${orderType === 'return' ? 'text-amber-600' : 'text-brand-600'}`}>x{item.quantity}</span>
                           <button onClick={() => removeFromCart(item.productId)} className="text-red-500 hover:text-red-700 p-1">
                             <Minus size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={handleSubmitOrder}
                    disabled={cart.length === 0 || isSubmitting}
                    className={`w-full py-4 rounded-lg font-bold text-lg text-white shadow-md flex justify-center items-center gap-2 transition-all active:scale-95 ${cart.length === 0 || isSubmitting ? 'bg-gray-400 dark:bg-slate-600 cursor-not-allowed' : orderType === 'return' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {isSubmitting ? 'Procesando...' : orderType === 'return' ? 'Enviar Devolución' : 'Pedir Botellas'}
                  </button>
                  {orderType === 'return' && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-3 text-center font-bold uppercase">
                      * El stock se actualizará cuando el almacén reciba las botellas.
                    </p>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden border border-gray-100 dark:border-slate-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {orderHistory.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-tighter ${order.type === 'return' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                      {order.type === 'return' ? 'Devolución' : 'Pedido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(order.timestamp).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                     <button onClick={() => setViewingOrder(order)} className="text-brand-600 hover:text-brand-700 text-xs font-bold flex items-center gap-1">
                       <Eye size={14} /> {order.items.reduce((acc, item) => acc + item.quantity, 0)} un.
                     </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-[10px] font-black rounded border-2 uppercase tracking-tight transition-all
                      ${order.status === 'pending' ? 'bg-red-50 text-red-600 border-red-500 dark:bg-red-950/40 dark:text-red-400 dark:border-red-600' : 
                        order.status === 'preparing' ? 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-600' :
                        'bg-emerald-50 text-emerald-700 border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-600'}
                    `}>
                      {order.status === 'pending' ? 'Pedido Enviado' : order.status === 'preparing' ? (order.type === 'return' ? 'PENDIENTE ENTREGA' : 'Recibido / Preparando') : 'ENTREGADO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingOrder && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Detalle de {viewingOrder.type === 'return' ? 'Devolución' : 'Pedido'}</h3>
                        <div className="text-sm text-gray-500 mt-1">ID: #{viewingOrder.id.slice(-6)}</div>
                    </div>
                    <button onClick={() => setViewingOrder(null)} className="text-gray-500 hover:text-gray-700 p-2"><X size={24} /></button>
                </div>
                <div className="p-0 overflow-y-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                            {viewingOrder.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <td className="px-5 py-3">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.productName}</div>
                                    </td>
                                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">x{item.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-900 flex justify-end">
                     <button onClick={() => setViewingOrder(null)} className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white rounded font-medium">Cerrar</button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
