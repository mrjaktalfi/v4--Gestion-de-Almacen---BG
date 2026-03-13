
import React, { useState, useEffect, useMemo } from 'react';
import { Product, AppSettings, Category } from '../types';
import { 
  subscribeToProducts, 
  subscribeToSettings, 
  subscribeToCategories,
  updateProductStock, 
  updateSettings,
  addCategory,
  deleteCategory,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribeToInventoryStats
} from '../services/dbService';
import { AlertTriangle, Edit2, Save, Printer, Plus, Trash2, X, Package, Search, Image as ImageIcon, Loader2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, Download } from 'lucide-react';
import { TrackerView } from './TrackerView';

export const AdminView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stats, setStats] = useState({ totalProducts: 0, totalUnits: 0, lowStockCount: 0 });
  const [loading, setLoading] = useState(true);
  
  // Stock Edit State
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editStockValue, setEditStockValue] = useState<number>(0);
  
  // Tabs: 'stock' | 'products' | 'tracker'
  const [activeTab, setActiveTab] = useState<'stock' | 'products' | 'tracker'>('stock');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Product Management State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    image: '',
    categoryId: '',
    current_stock: 0,
    threshold_low_stock: 10
  });

  // Image Search Modal State
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchTerm, setImageSearchTerm] = useState('');

  // Category Management State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    type: 'product' | 'category';
    id: string;
    name: string;
  }>({ show: false, type: 'product', id: '', name: '' });

  useEffect(() => {
    const unsubProducts = subscribeToProducts((data) => {
      setProducts(data);
    });

    const unsubSettings = subscribeToSettings((data) => {
      setSettings(data);
    });

    const unsubCategories = subscribeToCategories((data) => {
      setCategories(data);
    });

    const unsubStats = subscribeToInventoryStats((data) => {
      setStats(data);
    });

    const timer = setTimeout(() => setLoading(false), 1000);

    return () => {
      unsubProducts();
      unsubSettings();
      unsubCategories();
      unsubStats();
      clearTimeout(timer);
    };
  }, []);

  // --- Sorting Logic ---
  
  const sortedProducts = useMemo(() => {
    const sortableItems = [...products];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Handle specific calculated columns or direct properties
        if (sortConfig.key === 'available') {
            aValue = a.current_stock - a.reserved_stock;
            bValue = b.current_stock - b.reserved_stock;
        } else if (sortConfig.key === 'name') {
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        } else {
            // Default to accessing property directly (current_stock, reserved_stock)
            aValue = a[sortConfig.key as keyof Product];
            bValue = b[sortConfig.key as keyof Product];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [products, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // --- Actions ---

  const startStockEdit = (p: Product) => {
    setEditingStockId(p.id);
    setEditStockValue(p.current_stock);
  };

  const saveStockEdit = async (id: string) => {
    await updateProductStock(id, editStockValue);
    setEditingStockId(null);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      await addCategory(newCategoryName);
      setNewCategoryName('');
    } catch (e) {
      alert("Error al añadir categoría: " + (e as Error).message);
    }
  };

  const requestDeleteCategory = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      show: true,
      type: 'category',
      id: cat.id,
      name: cat.name
    });
  };

  const requestDeleteProduct = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      show: true,
      type: 'product',
      id: p.id,
      name: p.name
    });
  };

  const executeDelete = async () => {
    try {
      if (deleteConfirm.type === 'category') {
        await deleteCategory(deleteConfirm.id);
      } else {
        await deleteProduct(deleteConfirm.id);
      }
      setDeleteConfirm(prev => ({ ...prev, show: false }));
    } catch (e) {
      alert("Error al eliminar: " + (e as Error).message);
    }
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        image: product.image,
        categoryId: product.categoryId,
        current_stock: product.current_stock,
        threshold_low_stock: product.threshold_low_stock
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        image: '',
        categoryId: categories.length > 0 ? categories[0].id : '',
        current_stock: 0,
        threshold_low_stock: 10
      });
    }
    setShowProductModal(true);
  };

  const handleImageSearch = async () => {
    const term = imageSearchTerm || productForm.name;
    if (!term) {
      alert("Escribe un nombre para buscar.");
      return;
    }

    setShowImageSearchModal(true);
    setImageSearchTerm(term);
    setIsSearchingImages(true);
    setImageSearchResults([]);

    try {
      const results: string[] = [];

      // 1. Search OpenFoodFacts
      try {
        const offRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=10`);
        const offData = await offRes.json();
        if (offData.products) {
           offData.products.forEach((p: any) => {
              if (p.image_front_url) results.push(p.image_front_url);
              else if (p.image_url) results.push(p.image_url);
           });
        }
      } catch (e) { console.log('OpenFoodFacts fail', e); }

      // 2. Search TheCocktailDB
      try {
        const cocktailRes = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?i=${encodeURIComponent(term)}`);
        const cocktailData = await cocktailRes.json();
        if (cocktailData.ingredients) {
            const ingName = cocktailData.ingredients[0].strIngredient;
            results.push(`https://www.thecocktaildb.com/images/ingredients/${ingName}.png`);
            results.push(`https://www.thecocktaildb.com/images/ingredients/${ingName}-Medium.png`);
        }
      } catch (e) { console.log('CocktailDB fail', e); }

      // 3. Search Wikimedia Commons
      try {
        const wikiRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(term)}&gsrlimit=8&prop=imageinfo&iiprop=url&format=json&origin=*`);
        const wikiData = await wikiRes.json();
        if (wikiData.query && wikiData.query.pages) {
            Object.values(wikiData.query.pages).forEach((page: any) => {
                if (page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
                    const url = page.imageinfo[0].url;
                    if (url.match(/\.(jpeg|jpg|png|webp)$/i)) {
                        results.push(url);
                    }
                }
            });
        }
      } catch (e) { console.log('Wiki fail', e); }
      
      const uniqueResults = Array.from(new Set(results)).slice(0, 12);
      setImageSearchResults(uniqueResults);

    } catch (err) {
      console.error(err);
      alert("Error buscando imágenes.");
    } finally {
      setIsSearchingImages(false);
    }
  };

  const selectImage = (url: string) => {
      setProductForm({ ...productForm, image: url });
      setShowImageSearchModal(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.categoryId) {
      alert("Debes seleccionar una categoría");
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: productForm.name,
          image: productForm.image,
          categoryId: productForm.categoryId,
          current_stock: productForm.current_stock,
          threshold_low_stock: productForm.threshold_low_stock
        });
      } else {
        await addProduct({
          name: productForm.name,
          image: productForm.image,
          categoryId: productForm.categoryId,
          current_stock: productForm.current_stock,
          threshold_low_stock: productForm.threshold_low_stock,
          reserved_stock: 0
        });
      }
      setShowProductModal(false);
    } catch (err) {
      alert("Error al guardar producto: " + (err as Error).message);
    }
  };

  const downloadStockReport = () => {
    if (products.length === 0) return;
    
    // Header with BOM for Excel UTF-8 support
    let csvContent = "\uFEFFProducto,Categoría,Stock Físico,Reservado,Disponible,Estado\n";
    
    // Rows
    products.forEach(p => {
      const category = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
      const available = p.current_stock - p.reserved_stock;
      const status = available < p.threshold_low_stock ? 'Bajo Stock' : 'OK';
      
      // Escape commas and quotes
      const name = `"${p.name.replace(/"/g, '""')}"`;
      const catName = `"${category.replace(/"/g, '""')}"`;
      
      csvContent += `${name},${catName},${p.current_stock},${p.reserved_stock},${available},${status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Stock_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!settings) return <div className="dark:text-white">Cargando datos...</div>;

  return (
    <div className="space-y-6">
      {/* Admin Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700">
        <div className="flex space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-2 px-4 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'stock' ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Resumen y Stock
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-2 px-4 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'products' ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Gestión de Productos
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-2 px-4 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'tracker' ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Rastreador
          </button>
        </div>
        
        <button
          onClick={downloadStockReport}
          className="flex items-center space-x-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm mb-2"
          title="Descargar Reporte de Stock"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Descargar Stock</span>
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-blue-500 dark:border-blue-400">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Total Productos</h3>
                <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{stats.totalProducts}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-red-500 dark:border-red-400">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Alertas Stock Bajo</h3>
                <p className="text-3xl font-bold mt-2 text-red-600 dark:text-red-400">
                    {stats.lowStockCount}
                </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-purple-500 dark:border-purple-400">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Stock Total (Unidades)</h3>
                <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">
                    {stats.totalUnits}
                </p>
                </div>
            </div>

            {/* Quick Stock Adjustment Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="font-bold text-gray-800 dark:text-white">Ajuste Rápido de Stock</h3>
                </div>
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                    <tr>
                        <th 
                          onClick={() => requestSort('name')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <div className="flex items-center gap-1">
                             Producto {getSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          onClick={() => requestSort('current_stock')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <div className="flex items-center gap-1">
                             Stock Físico {getSortIcon('current_stock')}
                          </div>
                        </th>
                        <th 
                          onClick={() => requestSort('reserved_stock')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <div className="flex items-center gap-1">
                             Reservado {getSortIcon('reserved_stock')}
                          </div>
                        </th>
                        <th 
                          onClick={() => requestSort('available')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <div className="flex items-center gap-1">
                             Disponible {getSortIcon('available')}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acción</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {sortedProducts.map(p => {
                        const available = p.current_stock - p.reserved_stock;
                        const isCritical = available < p.threshold_low_stock;
                        return (
                        <tr key={p.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0">
                                <img className="h-10 w-10 rounded-full object-cover bg-gray-200" src={p.image || undefined} alt="" />
                                </div>
                                <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</div>
                                {isCritical && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                    <AlertTriangle size={12} className="mr-1"/> Bajo Stock
                                    </span>
                                )}
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                            {editingStockId === p.id ? (
                                <input
                                type="number"
                                value={editStockValue}
                                onChange={(e) => setEditStockValue(parseInt(e.target.value) || 0)}
                                className="w-20 border rounded px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                />
                            ) : (
                                <span className="text-sm text-gray-900 dark:text-white">{p.current_stock}</span>
                            )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {p.reserved_stock}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold ${available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {available}
                            </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {editingStockId === p.id ? (
                                <button onClick={() => saveStockEdit(p.id)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 flex items-center justify-end gap-1 ml-auto">
                                <Save size={16} /> Guardar
                                </button>
                            ) : (
                                <button onClick={() => startStockEdit(p)} className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 flex items-center justify-end gap-1 ml-auto">
                                <Edit2 size={16} /> Ajustar
                                </button>
                            )}
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Categories Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Package size={18} /> Categorías
              </h3>
              <div className="space-y-2 mb-4">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-900 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{cat.name}</span>
                    <button type="button" onClick={(e) => requestDeleteCategory(cat, e)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-gray-400 text-sm italic">Sin categorías</p>}
              </div>
              
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nueva categoría..." 
                  className="flex-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded px-2 py-1 text-sm"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                />
                <button type="submit" className="bg-gray-800 dark:bg-slate-700 text-white p-1 rounded hover:bg-black dark:hover:bg-slate-600">
                  <Plus size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Products List */}
          <div className="md:col-span-2 space-y-4">
             <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                <h3 className="font-bold text-gray-800 dark:text-white">Catálogo de Productos</h3>
                <button onClick={() => openProductModal()} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
                  <Plus size={18} /> Nuevo Producto
                </button>
             </div>

             <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                   <thead className="bg-gray-50 dark:bg-slate-900">
                     <tr>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Img</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoría</th>
                       <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                     {products.map(p => {
                       const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
                       return (
                         <tr key={p.id}>
                           <td className="px-4 py-3 whitespace-nowrap">
                             <img src={p.image || undefined} alt="" className="h-10 w-10 rounded-md object-cover bg-gray-200 dark:bg-slate-700" />
                           </td>
                           <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                           <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{catName}</td>
                           <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center h-16">
                             <button type="button" onClick={() => openProductModal(p)} className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                               <Edit2 size={18} />
                             </button>
                             <button type="button" onClick={(e) => requestDeleteProduct(p, e)} className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 z-10 cursor-pointer">
                               <Trash2 size={18} />
                             </button>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'tracker' && (
        <TrackerView products={products} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                ¿Eliminar {deleteConfirm.type === 'category' ? 'Categoría' : 'Producto'}?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Estás a punto de eliminar <span className="font-bold text-gray-800 dark:text-gray-200">"{deleteConfirm.name}"</span>.
                {deleteConfirm.type === 'category' && " Esto podría afectar a los productos asociados."}
                <br />Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow transition-colors flex justify-center items-center gap-2"
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-80 flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6 transition-colors max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded p-2 focus:ring-2 focus:ring-brand-500"
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                  placeholder="Ej. Cerveza Modelo 355ml"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                <select 
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded p-2 focus:ring-2 focus:ring-brand-500"
                  value={productForm.categoryId}
                  onChange={e => setProductForm({...productForm, categoryId: e.target.value})}
                  required
                >
                  <option value="">-- Seleccionar --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Actual</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded p-2 focus:ring-2 focus:ring-brand-500"
                    value={productForm.current_stock}
                    onChange={e => setProductForm({...productForm, current_stock: parseInt(e.target.value) || 0})}
                  />
                 </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alerta Stock Bajo</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded p-2 focus:ring-2 focus:ring-brand-500"
                    value={productForm.threshold_low_stock}
                    onChange={e => setProductForm({...productForm, threshold_low_stock: parseInt(e.target.value) || 0})}
                  />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Imagen</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded p-2 pr-10 text-sm"
                      value={productForm.image}
                      onChange={e => setProductForm({...productForm, image: e.target.value})}
                      placeholder="https://..."
                    />
                    <button 
                      type="button"
                      onClick={handleImageSearch}
                      title="Buscar imagen online"
                      className="absolute right-1 top-1 p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Search size={18} />
                    </button>
                  </div>
                   <img src={productForm.image || undefined} alt="Preview" className="w-10 h-10 rounded bg-gray-200 dark:bg-slate-700 object-cover border dark:border-slate-600" />
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                   <Search size={10} /> Pulsa la lupa para buscar y seleccionar una imagen.
                </p>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white font-bold rounded hover:bg-brand-700 shadow"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Search Modal (Popup) */}
      {showImageSearchModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-slate-700 pb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <ImageIcon /> Seleccionar Imagen
                      </h3>
                      <button onClick={() => setShowImageSearchModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="flex gap-2 mb-4">
                      <input 
                          type="text" 
                          className="flex-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white p-2 rounded"
                          value={imageSearchTerm}
                          onChange={(e) => setImageSearchTerm(e.target.value)}
                          placeholder="Nombre del producto..."
                      />
                      <button 
                          onClick={handleImageSearch}
                          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded flex items-center gap-2"
                      >
                          <Search size={18} /> Buscar
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                      {isSearchingImages ? (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                              <Loader2 className="animate-spin mb-2" size={32} />
                              <p>Buscando en bases de datos...</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              {imageSearchResults.length > 0 ? (
                                  imageSearchResults.map((url, idx) => (
                                      <div 
                                          key={idx} 
                                          className="aspect-square border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 relative group bg-white"
                                          onClick={() => selectImage(url)}
                                      >
                                           <img src={url || undefined} alt={`Option ${idx}`} className="w-full h-full object-contain p-2" />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                              <span className="text-white font-bold text-sm bg-black/50 px-2 py-1 rounded">Seleccionar</span>
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="col-span-full text-center text-gray-500 py-8">
                                      No se encontraron imágenes exactas. Intenta simplificar el nombre (ej. "Tanqueray" en vez de "Tanqueray Gin 700ml").
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-400 text-center">
                      Fuentes: OpenFoodFacts, TheCocktailDB, Wikimedia Commons
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
