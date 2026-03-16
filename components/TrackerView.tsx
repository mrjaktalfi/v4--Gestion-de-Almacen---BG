import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Calendar, MapPin, Package, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Product, Venue, Order } from '../types';
import { getAllOrders, subscribeToVenues } from '../services/dbService';

interface TrackerViewProps {
  products: Product[];
}

export const TrackerView: React.FC<TrackerViewProps> = ({ products }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'product' | 'venue'>('all');
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const allOrders = await getAllOrders();
      setOrders(allOrders);
      setLoading(false);
    };
    fetchOrders();

    const unsubscribeVenues = subscribeToVenues((v) => setVenues(v));
    return () => {
      unsubscribeVenues();
    };
  }, []);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filterType === 'product' && selectedId) {
      result = result.filter(order => 
        order.items.some(item => item.productId === selectedId)
      );
    } else if (filterType === 'venue' && selectedId) {
      result = result.filter(order => order.venueId === selectedId);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(order => {
        const venueMatch = order.venueName.toLowerCase().includes(lowerSearch);
        const productMatch = order.items.some(item => {
          const product = products.find(p => p.id === item.productId);
          return product?.name.toLowerCase().includes(lowerSearch);
        });
        return venueMatch || productMatch;
      });
    }

    return result;
  }, [orders, filterType, selectedId, searchTerm, products]);

  const handleFilterChange = (type: 'all' | 'product' | 'venue') => {
    setFilterType(type);
    setSelectedId('');
  };

  const formatDate = (dateValue?: string | number) => {
    if (!dateValue) return 'Fecha desconocida';
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Producto Desconocido';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rastreador de Movimientos</h2>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por local o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all' 
                  ? 'bg-brand-500 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => handleFilterChange('product')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'product' 
                  ? 'bg-brand-500 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              Por Producto
            </button>
            <button
              onClick={() => handleFilterChange('venue')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'venue' 
                  ? 'bg-brand-500 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              Por Local
            </button>
          </div>
        </div>

        {filterType === 'product' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Producto
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Selecciona un producto --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {filterType === 'venue' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Local
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Selecciona un local --</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No se encontraron movimientos con los filtros actuales.
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-gray-50 dark:bg-slate-800/50">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: order.venueColor }}
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {order.venueName}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.type === 'request' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                      {order.type === 'request' ? 'Pedido' : 'Devolución'}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Calendar size={14} className="mr-1" />
                    {formatDate((order as any).timestamp)}
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700 p-3">
                  <ul className="space-y-2">
                    {order.items.map((item, idx) => {
                      // Si estamos filtrando por producto, resaltar el producto seleccionado
                      const isHighlighted = filterType === 'product' && selectedId === item.productId;
                      
                      if (filterType === 'product' && selectedId && !isHighlighted) {
                        return null; // Ocultar otros items si filtramos por producto específico
                      }

                      return (
                        <li key={idx} className={`flex justify-between items-center text-sm ${isHighlighted ? 'font-medium text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-gray-400" />
                            <span>{getProductName(item.productId)}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            {order.type === 'request' ? (
                              <ArrowUpRight size={14} className="text-red-500" />
                            ) : (
                              <ArrowDownRight size={14} className="text-green-500" />
                            )}
                            {item.quantity} un.
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
