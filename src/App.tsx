/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  History, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Gamepad2,
  User as UserIcon,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Download,
  LogOut,
  Shield,
  Lock,
  Users,
  ShoppingCart,
  Package,
  PlusCircle,
  MinusCircle,
  X,
  Printer,
  Receipt as ReceiptIcon,
  Search
} from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds, addMinutes, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';
import { Console, RentalHistory, Settings, User, Product, Sale, SaleItem } from './types';

const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'staff', password: 'staff123', role: 'staff' },
];

const DEFAULT_RATES = {
  PS3: 5000,
  PS4: 8000,
  PS5: 12000,
};

const INITIAL_CONSOLES: Console[] = [
  { id: '1', name: 'Console 01', type: 'PS5', status: 'available', hourlyRate: DEFAULT_RATES.PS5, relayId: 1 },
  { id: '2', name: 'Console 02', type: 'PS5', status: 'available', hourlyRate: DEFAULT_RATES.PS5, relayId: 2 },
  { id: '3', name: 'Console 03', type: 'PS4', status: 'available', hourlyRate: DEFAULT_RATES.PS4, relayId: 3 },
  { id: '4', name: 'Console 04', type: 'PS4', status: 'available', hourlyRate: DEFAULT_RATES.PS4, relayId: 4 },
  { id: '5', name: 'Console 05', type: 'PS3', status: 'available', hourlyRate: DEFAULT_RATES.PS3, relayId: 5 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings' | 'products'>('dashboard');
  const [consoles, setConsoles] = useState<Console[]>(() => {
    const saved = localStorage.getItem('ps_consoles');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure relayId exists for all consoles
      return parsed.map((c: any, index: number) => ({
        ...c,
        relayId: c.relayId || (index + 1)
      }));
    }
    return INITIAL_CONSOLES;
  });
  const [history, setHistory] = useState<RentalHistory[]>(() => {
    const saved = localStorage.getItem('ps_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('ps_products');
    return saved ? JSON.parse(saved) : [];
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('ps_sales');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('ps_settings');
    return saved ? JSON.parse(saved) : { 
      rates: DEFAULT_RATES,
      relayBaseUrl: 'http://10.24.59.55'
    };
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ps_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('ps_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    localStorage.setItem('ps_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('ps_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('ps_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('ps_current_user', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('ps_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('ps_consoles', JSON.stringify(consoles));
  }, [consoles]);

  useEffect(() => {
    localStorage.setItem('ps_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('ps_settings', JSON.stringify(settings));
  }, [settings]);

  // Relay Control Helper
  const controlRelay = async (relayId: number, command: 0 | 1) => {
    const url = `${settings.relayBaseUrl}/relay?r=${relayId}&cmd=${command}&t=${Date.now()}`;
    
    console.log(`Triggering Relay ${relayId} (${command}) via ${url}`);

    // Method 1: Fetch (standard)
    try {
      await fetch(url, { 
        mode: 'no-cors',
        cache: 'no-cache',
        priority: 'high'
      });
    } catch (error) {
      // Method 2: Image Beacon (Fallback for Mixed Content/Local Network issues)
      // This is often more successful for triggering simple GET requests to local devices from HTTPS
      const img = new Image();
      img.src = url;
      img.onerror = () => {
        // We expect an error because the relay usually doesn't return a valid image
        // but the request is still sent to the network.
      };
    }
  };

  // Auto-stop logic
  useEffect(() => {
    const checkAutoStop = () => {
      const now = Date.now();
      consoles.forEach(c => {
        if (c.status === 'playing' && c.startTime && c.durationMinutes) {
          const elapsed = differenceInMinutes(now, c.startTime);
          if (elapsed >= c.durationMinutes) {
            console.log(`Auto-stopping ${c.name} - Time is up`);
            stopRental(c.id);
          }
        }
      });
    };

    const interval = setInterval(checkAutoStop, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [consoles]);

  const startRental = React.useCallback((consoleId: string, customerName: string, durationMinutes?: number) => {
    const consoleToStart = consoles.find(c => c.id === consoleId);
    if (consoleToStart) {
      controlRelay(consoleToStart.relayId, 1);
    }

    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId) {
        return {
          ...c,
          status: 'playing',
          startTime: Date.now(),
          durationMinutes: durationMinutes || undefined,
          customerName: customerName || 'Guest'
        };
      }
      return c;
    }));
  }, [consoles]);

  const stopRental = React.useCallback((consoleId: string) => {
    const console = consoles.find(c => c.id === consoleId);
    if (!console || !console.startTime) return;

    const endTime = Date.now();
    
    // Control Relay
    controlRelay(console.relayId, 0);

    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId) {
        return {
          ...c,
          status: 'finished',
          endTime: endTime,
        };
      }
      return c;
    }));
  }, [consoles]);

  const payRental = React.useCallback((historyEntry: RentalHistory) => {
    setHistory(prev => [historyEntry, ...prev]);
    
    // Mark associated F&B sales as paid
    setSales(prev => prev.map(s => {
      if (s.consoleId === historyEntry.consoleId && !s.isPaid && s.timestamp >= historyEntry.startTime) {
        return { ...s, isPaid: true };
      }
      return s;
    }));

    setConsoles(prev => prev.map(c => {
      if (c.id === historyEntry.consoleId) {
        return {
          ...c,
          status: 'available',
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          customerName: undefined
        };
      }
      return c;
    }));
  }, []);

  const resetConsole = React.useCallback((consoleId: string) => {
    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId) {
        return {
          ...c,
          status: 'available',
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          customerName: undefined
        };
      }
      return c;
    }));
  }, []);

  const addTime = React.useCallback((consoleId: string, extraMinutes: number) => {
    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId && (c.status === 'playing' || c.status === 'finished')) {
        return {
          ...c,
          status: 'playing',
          endTime: undefined,
          durationMinutes: (c.durationMinutes || 0) + extraMinutes
        };
      }
      return c;
    }));
  }, []);

  const resumeRental = React.useCallback((consoleId: string) => {
    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId && c.status === 'finished') {
        return {
          ...c,
          status: 'playing',
          endTime: undefined
        };
      }
      return c;
    }));
  }, []);

  const stats = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const todayHistory = history.filter(h => h.startTime >= today);
    const todaySales = sales.filter(s => s.isPaid && s.timestamp >= today);
    
    const totalRevenue = todayHistory.reduce((acc, curr) => acc + (curr.totalBill || curr.totalCost), 0) +
                         todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
                         
    const totalSessions = todayHistory.length;
    const activeConsoles = consoles.filter(c => c.status === 'playing').length;

    return { totalRevenue, totalSessions, activeConsoles };
  }, [history, consoles, sales]);

  const handleLogin = (username: string, password: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleSale = (sale: Sale) => {
    setSales(prev => [sale, ...prev]);
    // Update product quantities
    setProducts(prev => prev.map(p => {
      const saleItem = sale.items.find(si => si.productId === p.id);
      if (saleItem) {
        return { ...p, quantity: p.quantity - saleItem.quantity };
      }
      return p;
    }));
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.text('LAPORAN PENDAPATAN VMS PLAY', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm:ss')}`, 14, 28);
    doc.text(`Oleh: ${currentUser?.username}`, 14, 34);

    // Rental Summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Ringkasan Rental Console', 14, 45);
    
    const rentalTableData = history.map(item => [
      item.customerName,
      item.consoleName,
      `${format(item.startTime, 'dd/MM/yy HH:mm')} - ${format(item.endTime, 'HH:mm')}`,
      `${item.totalDurationMinutes} Menit`,
      `Rp ${item.totalCost.toLocaleString()}`,
      `Rp ${(item.fnbCost || 0).toLocaleString()}`,
      `Rp ${(item.totalBill || item.totalCost).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Customer', 'Console', 'Waktu', 'Durasi', 'Rental', 'F&B', 'Total']],
      body: rentalTableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // F&B Summary
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(14);
    doc.text('2. Ringkasan Penjualan F&B', 14, finalY + 15);

    const salesTableData = sales.filter(s => s.isPaid).map(sale => [
      format(sale.timestamp, 'dd/MM/yy HH:mm'),
      sale.items.map(i => `${i.productName} (x${i.quantity})`).join(', '),
      sale.customerName || 'Guest',
      `Rp ${sale.totalAmount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Waktu', 'Item', 'Customer', 'Total']],
      body: salesTableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }
    });

    // Total Revenue
    const totalRental = history.reduce((a, b) => a + b.totalCost, 0);
    const totalSales = sales.filter(s => s.isPaid).reduce((a, b) => a + b.totalAmount, 0);
    const finalY2 = (doc as any).lastAutoTable.finalY || finalY + 20;

    doc.setFontSize(12);
    doc.text(`Total Pendapatan Rental: Rp ${totalRental.toLocaleString()}`, 14, finalY2 + 15);
    doc.text(`Total Pendapatan F&B: Rp ${totalSales.toLocaleString()}`, 14, finalY2 + 22);
    doc.setFontSize(14);
    doc.text(`TOTAL PENDAPATAN: Rp ${(totalRental + totalSales).toLocaleString()}`, 14, finalY2 + 32);

    doc.save(`Laporan_Rental_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 hidden md:flex flex-col">
        <div className="p-6 border-bottom border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Gamepad2 size={24} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">VMS PLAY</h1>
          </div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Management System</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <NavButton 
            active={activeTab === 'pos'} 
            onClick={() => setActiveTab('pos')}
            icon={<ShoppingCart size={20} />}
            label="POS F&B"
          />
          <NavButton 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')}
            icon={<Package size={20} />}
            label="Produk F&B"
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History size={20} />}
            label="Laporan"
          />
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<SettingsIcon size={20} />}
            label="Pengaturan"
          />
        </nav>

        <div className="p-6 border-t border-gray-100 space-y-4">
          <div className="bg-indigo-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                {currentUser.role === 'admin' ? <Shield size={18} /> : <UserIcon size={18} />}
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900 truncate">{currentUser.username}</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase">{currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white text-red-500 rounded-xl text-xs font-bold shadow-sm hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Current Time</p>
            <p className="text-sm font-bold text-gray-900">{format(currentTime, 'HH:mm:ss')}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'pos' && 'Point of Sale (POS)'}
              {activeTab === 'history' && 'Laporan Penggunaan'}
              {activeTab === 'settings' && 'Pengaturan Sistem'}
              {activeTab === 'products' && 'Master Produk F&B'}
            </h2>
            <p className="text-gray-500 text-sm">
              {activeTab === 'dashboard' && 'Pantau dan kelola timer rental secara real-time.'}
              {activeTab === 'pos' && 'Lakukan penjualan makanan dan minuman secara cepat.'}
              {activeTab === 'history' && 'Riwayat transaksi dan pendapatan rental.'}
              {activeTab === 'settings' && 'Konfigurasi tarif dan daftar console.'}
              {activeTab === 'products' && 'Kelola stok dan harga makanan & minuman.'}
            </p>
          </div>

          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-400 uppercase">Today's Revenue</span>
                <span className="text-xl font-bold text-emerald-600">Rp {(stats.totalRevenue + sales.filter(s => s.timestamp >= new Date().setHours(0,0,0,0)).reduce((a, b) => a + b.totalAmount, 0)).toLocaleString()}</span>
              </div>
              <div className="h-10 w-[1px] bg-gray-200 mx-2" />
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-400 uppercase">Active</span>
                <span className="text-xl font-bold text-indigo-600">{stats.activeConsoles} / {consoles.length}</span>
              </div>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'pos' && (
            <motion.div 
              key="pos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]"
            >
              <POS products={products} onSale={handleSale} settings={settings} />
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div 
              key="products"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Daftar Produk</h3>
                <button 
                  onClick={() => {
                    const newId = Math.random().toString(36).substr(2, 9);
                    setProducts(prev => [...prev, {
                      id: newId,
                      name: 'Produk Baru',
                      purchasePrice: 0,
                      sellingPrice: 0,
                      quantity: 0
                    }]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  <Plus size={16} />
                  Tambah Produk
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <div key={product.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <input 
                          value={product.name}
                          onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, name: e.target.value } : p))}
                          className="text-lg font-bold text-gray-900 bg-transparent focus:outline-none w-full"
                          placeholder="Nama Produk"
                        />
                        <p className="text-xs text-gray-400">ID: {product.id}</p>
                      </div>
                      <button 
                        onClick={() => setProducts(prev => prev.filter(p => p.id !== product.id))}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Harga Beli</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                          <input 
                            type="number"
                            value={product.purchasePrice || 0}
                            onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, purchasePrice: parseInt(e.target.value) || 0 } : p))}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Harga Jual</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                          <input 
                            type="number"
                            value={product.sellingPrice || 0}
                            onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, sellingPrice: parseInt(e.target.value) || 0 } : p))}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Stok (Quantity)</label>
                      <input 
                        type="number"
                        value={product.quantity || 0}
                        onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
                    <Package size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-medium">Belum ada produk F&B.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {consoles.map((consoleItem: Console) => (
                <ConsoleCard 
                  key={consoleItem.id} 
                  console={consoleItem} 
                  onStart={startRental} 
                  onStop={stopRental}
                  onPay={payRental}
                  onReset={resetConsole}
                  onResume={resumeRental}
                  onAddTime={addTime}
                  onSale={handleSale}
                  products={products}
                  sales={sales}
                  currentTime={currentTime}
                  settings={settings}
                />
              ))}
              <button 
                onClick={() => setActiveTab('settings')}
                className="border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center p-8 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:bg-indigo-50 transition-colors">
                  <Plus size={24} />
                </div>
                <span className="font-semibold">Tambah Console</span>
              </button>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900">Riwayat Rental</h3>
                  <button 
                    onClick={exportToPDF}
                    disabled={history.length === 0 && sales.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Download size={16} />
                    Export Laporan PDF
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer / Console</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Durasi</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rental</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">F&B</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Total</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            Belum ada riwayat rental.
                          </td>
                        </tr>
                      ) : (
                        history.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                  <UserIcon size={14} />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{item.customerName}</p>
                                  <p className="text-xs text-gray-400">{item.consoleName} ({item.hourlyRate.toLocaleString()}/jam)</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm">
                                <p className="text-gray-900 font-medium">{format(item.startTime, 'HH:mm')} - {format(item.endTime, 'HH:mm')}</p>
                                <p className="text-xs text-gray-400">{format(item.startTime, 'dd MMM yyyy')}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                {item.totalDurationMinutes} Menit
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-600">Rp {item.totalCost.toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-600">Rp {(item.fnbCost || 0).toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-emerald-600 text-right">Rp {(item.totalBill || item.totalCost).toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {currentUser.role === 'admin' && (
                                <button 
                                  onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                  <h3 className="font-bold text-gray-900">Detail Penjualan F&B</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sales.filter(s => s.isPaid).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            Belum ada riwayat penjualan F&B.
                          </td>
                        </tr>
                      ) : (
                        sales.filter(s => s.isPaid).map(sale => (
                          <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-gray-900">{sale.customerName || 'Guest'}</p>
                              {sale.consoleId && <p className="text-[10px] text-indigo-600 font-bold">Console ID: {sale.consoleId}</p>}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {sale.items.map((item, idx) => (
                                  <p key={idx} className="text-xs font-medium text-gray-700">
                                    {item.productName} x{item.quantity}
                                  </p>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-600">{format(sale.timestamp, 'HH:mm')}</p>
                              <p className="text-[10px] text-gray-400">{format(sale.timestamp, 'dd MMM yyyy')}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-black text-emerald-600">Rp {sale.totalAmount.toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {currentUser.role === 'admin' && (
                                <button 
                                  onClick={() => setSales(prev => prev.filter(s => s.id !== sale.id))}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl space-y-8"
            >
              <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <SettingsIcon size={20} className="text-indigo-600" />
                  Konfigurasi Relay
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Relay Base URL (IP Address)</label>
                    <input 
                      type="text" 
                      value={settings.relayBaseUrl || ''}
                      disabled={currentUser.role !== 'admin'}
                      onChange={(e) => setSettings(prev => ({ ...prev, relayBaseUrl: e.target.value }))}
                      placeholder="http://10.24.59.55"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono text-sm disabled:opacity-70"
                    />
                    <p className="text-[10px] text-gray-400 italic">Pastikan menyertakan http:// di depan alamat IP.</p>
                  </div>
                </div>
              </section>

              <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <DollarSign size={20} className="text-indigo-600" />
                  Tarif Per Jam
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['PS3', 'PS4', 'PS5'] as const).map(type => (
                    <div key={type} className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">{type}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">Rp</span>
                        <input 
                          type="number" 
                          value={settings.rates[type] || 0}
                          disabled={currentUser.role !== 'admin'}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            rates: { ...prev.rates, [type]: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold disabled:opacity-70"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Gamepad2 size={20} className="text-indigo-600" />
                    Daftar Console
                  </h3>
                  {currentUser.role === 'admin' && (
                    <button 
                      onClick={() => {
                        const newId = (consoles.length + 1).toString();
                        const newRelayId = consoles.length + 1;
                        setConsoles(prev => [...prev, {
                          id: newId,
                          name: `Console ${newId.padStart(2, '0')}`,
                          type: 'PS4',
                          status: 'available',
                          hourlyRate: settings.rates.PS4,
                          relayId: newRelayId
                        }]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                    >
                      <Plus size={16} />
                      Tambah
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {consoles.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs",
                          c.type === 'PS5' ? "bg-blue-100 text-blue-600" : 
                          c.type === 'PS4' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {c.type}
                        </div>
                        <div>
                          <input 
                            value={c.name || ''}
                            disabled={currentUser.role !== 'admin'}
                            onChange={(e) => setConsoles(prev => prev.map(item => item.id === c.id ? { ...item, name: e.target.value } : item))}
                            className="bg-transparent font-bold text-gray-900 focus:outline-none disabled:opacity-70"
                          />
                          <select 
                            value={c.type}
                            disabled={currentUser.role !== 'admin'}
                            onChange={(e) => {
                              const type = e.target.value as any;
                              setConsoles(prev => prev.map(item => item.id === c.id ? { ...item, type, hourlyRate: settings.rates[type] } : item));
                            }}
                            className="block text-xs text-gray-400 bg-transparent focus:outline-none disabled:opacity-70"
                          >
                            <option value="PS3">PS3</option>
                            <option value="PS4">PS4</option>
                            <option value="PS5">PS5</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Relay ID</label>
                          <input 
                            type="number"
                            value={c.relayId || 0}
                            disabled={currentUser.role !== 'admin'}
                            onChange={(e) => setConsoles(prev => prev.map(item => item.id === c.id ? { ...item, relayId: parseInt(e.target.value) || 0 } : item))}
                            className="w-12 bg-transparent text-right font-bold text-gray-900 focus:outline-none disabled:opacity-70"
                          />
                        </div>
                        {currentUser.role === 'admin' && (
                          <button 
                            onClick={() => setConsoles(prev => prev.filter(item => item.id !== c.id))}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {currentUser.role === 'admin' && (
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Users size={20} className="text-indigo-600" />
                      Manajemen User
                    </h3>
                    <button 
                      onClick={() => {
                        const newId = Math.random().toString(36).substr(2, 9);
                        setUsers(prev => [...prev, {
                          id: newId,
                          username: `user_${newId.substr(0, 4)}`,
                          password: 'password123',
                          role: 'staff'
                        }]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                    >
                      <Plus size={16} />
                      Tambah User
                    </button>
                  </div>
                  <div className="space-y-3">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs",
                            u.role === 'admin' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {u.role === 'admin' ? <Shield size={18} /> : <UserIcon size={18} />}
                          </div>
                          <div>
                            <input 
                              value={u.username || ''}
                              onChange={(e) => setUsers(prev => prev.map(item => item.id === u.id ? { ...item, username: e.target.value } : item))}
                              className="bg-transparent font-bold text-gray-900 focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <Lock size={10} className="text-gray-400" />
                              <input 
                                type="password"
                                value={u.password || ''}
                                onChange={(e) => setUsers(prev => prev.map(item => item.id === u.id ? { ...item, password: e.target.value } : item))}
                                className="bg-transparent text-xs text-gray-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <select 
                            value={u.role}
                            onChange={(e) => setUsers(prev => prev.map(item => item.id === u.id ? { ...item, role: e.target.value as any } : item))}
                            className="text-xs font-bold text-gray-500 bg-transparent focus:outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                          </select>
                          {u.id !== currentUser.id && (
                            <button 
                              onClick={() => setUsers(prev => prev.filter(item => item.id !== u.id))}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 flex justify-around md:hidden z-50">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} />
        <MobileNavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<ShoppingCart size={20} />} />
        <MobileNavButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Package size={20} />} />
        <MobileNavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} />
        <MobileNavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={20} />} />
        <button 
          onClick={handleLogout}
          className="p-3 rounded-xl text-red-500"
        >
          <LogOut size={20} />
        </button>
      </nav>
    </div>
  );
}

// Thermal Receipt Component (58mm)
function ThermalReceipt({ sale, settings }: { sale: Sale, settings: Settings }) {
  return (
    <div id="thermal-receipt" className="hidden print:block bg-white text-black font-mono text-[10px] w-[58mm] p-2 leading-tight">
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold uppercase">VMS PLAY</h2>
        <p className="text-[8px] opacity-70">Manajemen PS Rental & F&B</p>
      </div>
      
      <div className="border-t border-dashed border-black my-2"></div>
      
      <div className="flex justify-between mb-1">
        <span>Nota:</span>
        <span>#{sale.id.toUpperCase()}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Tgl:</span>
        <span>{format(sale.timestamp, 'dd/MM/yy HH:mm')}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Cust:</span>
        <span>{sale.customerName || 'Guest'}</span>
      </div>
      {sale.consoleId && (
        <div className="flex justify-between mb-1">
          <span>Console:</span>
          <span>{sale.consoleId}</span>
        </div>
      )}

      <div className="border-t border-dashed border-black my-2"></div>

      <div className="space-y-1">
        {sale.items.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between">
              <span className="flex-1 truncate">{item.productName}</span>
              <span className="ml-2">x{item.quantity}</span>
            </div>
            <div className="flex justify-between text-[8px] opacity-70">
              <span>@{item.price.toLocaleString()}</span>
              <span>{item.total.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      <div className="flex justify-between font-bold text-xs">
        <span>TOTAL:</span>
        <span>Rp {sale.totalAmount.toLocaleString()}</span>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      <div className="text-center mt-4 mb-8">
        <p className="font-bold uppercase">Terima Kasih</p>
        <p className="text-[8px] mt-1 italic">Silakan Datang Kembali</p>
      </div>
      
      {/* Extra space for cutter */}
      <div className="h-12"></div>
    </div>
  );
}

// Rental Receipt Component (58mm)
function RentalReceipt({ history, settings }: { history: RentalHistory, settings: Settings }) {
  return (
    <div id="rental-receipt" className="hidden print:block bg-white text-black font-mono text-[10px] w-[58mm] p-2 leading-tight">
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold uppercase">VMS PLAY</h2>
        <p className="text-[8px] opacity-70">Manajemen PS Rental & F&B</p>
      </div>
      
      <div className="border-t border-dashed border-black my-2"></div>
      
      <div className="space-y-1 mb-4">
        <div className="flex justify-between">
          <span>ID:</span>
          <span>#{history.id.toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>Waktu:</span>
          <span>{format(history.endTime, 'dd/MM/yy HH:mm')}</span>
        </div>
        <div className="flex justify-between">
          <span>Cust:</span>
          <span>{history.customerName}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      <div className="space-y-2 mb-4">
        <div>
          <div className="flex justify-between font-bold">
            <span>{history.consoleName}</span>
          </div>
          <div className="flex justify-between opacity-80">
            <span>{format(history.startTime, 'HH:mm')} - {format(history.endTime, 'HH:mm')}</span>
          </div>
          <div className="flex justify-between opacity-80">
            <span>{history.totalDurationMinutes} Menit @ {history.hourlyRate.toLocaleString()}</span>
            <span>{history.totalCost.toLocaleString()}</span>
          </div>
        </div>
        {history.fnbCost > 0 && (
          <div className="flex justify-between opacity-80">
            <span>F&B / Snack</span>
            <span>{history.fnbCost.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      <div className="flex justify-between text-sm font-bold mt-2">
        <span>TOTAL:</span>
        <span>Rp {history.totalBill.toLocaleString()}</span>
      </div>

      <div className="text-center mt-6 pt-4 border-t border-dashed border-black">
        <p className="uppercase font-bold">Terima Kasih</p>
        <p className="text-[8px] mt-1">Silakan Datang Kembali</p>
      </div>
      
      {/* Extra space for cutter */}
      <div className="h-12"></div>
    </div>
  );
}

function SaleModal({ console: consoleItem, products, onClose, onSale, settings }: { console: Console, products: Product[], onClose: () => void, onSale: (s: Sale) => void, settings: Settings }) {
  const [cart, setCart] = useState<{ productId: string, quantity: number }[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const addToCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.productId !== productId);
    });
  };

  const totalAmount = cart.reduce((acc, item) => {
    const product = products.find(p => p.id === item.productId);
    return acc + (product ? product.sellingPrice * item.quantity : 0);
  }, 0);

  const handleSubmit = () => {
    if (cart.length === 0) return;

    const saleItems: SaleItem[] = cart.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.sellingPrice,
        total: product.sellingPrice * item.quantity
      };
    });

    const sale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      items: saleItems,
      totalAmount,
      timestamp: Date.now(),
      consoleId: consoleItem.id,
      customerName: consoleItem.customerName || 'Guest',
      isPaid: false
    };

    onSale(sale);
    setLastSale(sale);
  };

  const handlePrint = () => {
    window.print();
  };

  if (lastSale) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Pesanan Tersimpan!</h3>
          <p className="text-gray-500 mb-8">F&B telah ditambahkan ke tagihan console.</p>
          
          <div className="space-y-3">
            <button 
              onClick={handlePrint}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
            >
              <Printer size={20} />
              Cetak Pesanan
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Tutup
            </button>
          </div>

          {/* Hidden receipt for printing */}
          <ThermalReceipt sale={lastSale} settings={settings} />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
          <div>
            <h3 className="text-xl font-bold">Beli F&B - {consoleItem.name}</h3>
            <p className="text-xs opacity-80">{consoleItem.customerName || 'Guest'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Product List */}
          <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Menu F&B</h4>
            <div className="grid grid-cols-1 gap-3">
              {products.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-900">{product.name}</p>
                    <p className="text-xs text-indigo-600 font-bold">Rp {product.sellingPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">Stok: {product.quantity}</p>
                  </div>
                  <button 
                    onClick={() => addToCart(product.id)}
                    disabled={product.quantity <= 0}
                    className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm border border-gray-100 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-center py-10 text-gray-400 text-sm italic">Belum ada produk.</p>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="w-full md:w-72 bg-gray-50 p-6 flex flex-col">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Keranjang</h4>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6">
              {cart.map(item => {
                const product = products.find(p => p.id === item.productId)!;
                return (
                  <div key={item.productId} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">Rp {(product.sellingPrice * item.quantity).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button onClick={() => removeFromCart(item.productId)} className="text-gray-400 hover:text-red-500">
                        <MinusCircle size={18} />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart(item.productId)} className="text-gray-400 hover:text-indigo-600">
                        <PlusCircle size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {cart.length === 0 && (
                <p className="text-center py-10 text-gray-400 text-xs italic">Keranjang kosong.</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">Total</span>
                <span className="text-xl font-black text-indigo-600">Rp {totalAmount.toLocaleString()}</span>
              </div>
              <button 
                onClick={handleSubmit}
                disabled={cart.length === 0}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function POS({ products, onSale, settings }: { products: Product[], onSale: (s: Sale) => void, settings: Settings }) {
  const [cart, setCart] = useState<{ productId: string, quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      const product = products.find(p => p.id === productId);
      if (!product) return prev;
      
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.productId !== productId);
    });
  };

  const totalAmount = cart.reduce((acc, item) => {
    const product = products.find(p => p.id === item.productId);
    return acc + (product ? product.sellingPrice * item.quantity : 0);
  }, 0);

  const handleSubmit = () => {
    if (cart.length === 0) return;

    const saleItems: SaleItem[] = cart.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.sellingPrice,
        total: product.sellingPrice * item.quantity
      };
    });

    const sale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      items: saleItems,
      totalAmount,
      timestamp: Date.now(),
      customerName: customerName || 'Guest',
      isPaid: true
    };

    onSale(sale);
    setLastSale(sale);
    setCart([]);
    setCustomerName('');
  };

  const handlePrint = () => {
    window.print();
  };

  if (lastSale) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={48} />
        </div>
        <h3 className="text-3xl font-black text-gray-900 mb-2">Transaksi Berhasil!</h3>
        <p className="text-gray-500 mb-8 max-w-md">Penjualan F&B telah dicatat dan stok produk telah diperbarui secara otomatis.</p>
        
        <div className="flex gap-4">
          <button 
            onClick={handlePrint}
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200"
          >
            <Printer size={20} />
            Cetak Nota (58mm)
          </button>
          <button 
            onClick={() => setLastSale(null)}
            className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            Transaksi Baru
          </button>
        </div>

        {/* Hidden receipt for printing */}
        <ThermalReceipt sale={lastSale} settings={settings} />
      </div>
    );
  }

  return (
    <>
      {/* Product Selection */}
      <div className="flex-1 p-8 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-gray-900">Pilih Produk</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product.id)}
                disabled={product.quantity <= 0}
                className="group p-4 bg-gray-50 rounded-3xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left relative overflow-hidden disabled:opacity-50 disabled:hover:border-gray-100 disabled:hover:bg-gray-50"
              >
                <div className="relative z-10">
                  <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{product.name}</p>
                  <p className="text-sm font-black text-indigo-600 mt-1">Rp {product.sellingPrice.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      product.quantity > 5 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    )}>
                      Stok: {product.quantity}
                    </span>
                  </div>
                </div>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                  <Package size={80} />
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <Search size={32} />
                </div>
                <p className="text-gray-400 font-medium">Produk tidak ditemukan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full md:w-96 bg-gray-50 border-l border-gray-100 p-8 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <ShoppingCart size={20} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Keranjang</h3>
        </div>

        <div className="mb-6 space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama Customer</label>
          <input 
            type="text"
            placeholder="Guest"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-8">
          {cart.map(item => {
            const product = products.find(p => p.id === item.productId)!;
            return (
              <div key={item.productId} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-indigo-600 font-bold">Rp {(product.sellingPrice * item.quantity).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <MinusCircle size={18} />
                  </button>
                  <span className="font-black text-gray-900 w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => addToCart(item.productId)}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                  >
                    <PlusCircle size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-gray-200 shadow-sm">
                <ShoppingCart size={32} />
              </div>
              <p className="text-gray-400 text-sm font-medium">Keranjang masih kosong</p>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-500">Total Pembayaran</span>
            <span className="text-2xl font-black text-indigo-600">Rp {totalAmount.toLocaleString()}</span>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={cart.length === 0}
            className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
          >
            <CheckCircle2 size={24} />
            Simpan
          </button>
        </div>
      </div>
    </>
  );
}

function Login({ onLogin }: { onLogin: (u: string, p: string) => boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin(username, password)) {
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-indigo-100/50 border border-gray-100"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-indigo-200 mb-6">
            <Gamepad2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">PS RENTAL</h1>
          <p className="text-gray-400 font-medium mt-2">Silakan masuk untuk melanjutkan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold"
                placeholder="Masukkan password"
                required
              />
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-bold text-red-500"
            >
              Username atau password salah!
            </motion.p>
          )}

          <button 
            type="submit"
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            Masuk Sekarang
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400 font-medium">
            Lupa password? Hubungi Administrator.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

interface ConsoleCardProps {
  key?: string | number;
  console: Console;
  onStart: (consoleId: string, customerName: string, durationMinutes?: number) => void;
  onStop: (consoleId: string) => void;
  onPay: (history: RentalHistory) => void;
  onReset: (consoleId: string) => void;
  onResume: (consoleId: string) => void;
  onAddTime: (consoleId: string, extraMinutes: number) => void;
  onSale: (sale: Sale) => void;
  products: Product[];
  sales: Sale[];
  currentTime: number;
  settings: Settings;
}

function ConsoleCard({ console, onStart, onStop, onPay, onReset, onResume, onAddTime, onSale, products, sales, currentTime, settings }: ConsoleCardProps) {
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState<string>(''); // in minutes
  const [extraMinutes, setExtraMinutes] = useState<string>('30');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastRentalHistory, setLastRentalHistory] = useState<RentalHistory | null>(null);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isPlaying = console.status === 'playing';
  const isFinished = console.status === 'finished';
  
  const elapsedSeconds = (isPlaying || isFinished) && console.startTime 
    ? differenceInSeconds(isFinished && console.endTime ? console.endTime : currentTime, console.startTime) 
    : 0;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const remainingSeconds = isPlaying && console.startTime && console.durationMinutes
    ? Math.max(0, (console.durationMinutes * 60) - elapsedSeconds)
    : null;

  const progress = (isPlaying || isFinished) && console.durationMinutes
    ? Math.min(100, (elapsedSeconds / (console.durationMinutes * 60)) * 100)
    : 0;

  const consoleSales = useMemo(() => {
    if (!console.startTime) return [];
    return sales.filter(s => s.consoleId === console.id && !s.isPaid && s.timestamp >= console.startTime!);
  }, [sales, console.id, console.startTime]);

  const totalSalesAmount = useMemo(() => {
    return consoleSales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [consoleSales]);

  const currentRentalCost = (isPlaying || isFinished) && console.startTime
    ? Math.ceil((Math.max(1, elapsedMinutes) / 60) * console.hourlyRate)
    : 0;

  const totalCurrentBill = currentRentalCost + totalSalesAmount;

  const isTimeUp = remainingSeconds !== null && remainingSeconds === 0;

  const wasTimeUp = console.durationMinutes && elapsedMinutes >= console.durationMinutes;

  const handleBatalOrLanjut = () => {
    if (wasTimeUp) {
      onAddTime(console.id, 30);
    } else {
      onResume(console.id);
    }
  };

  const handlePay = () => {
    if (!console.startTime) return;
    
    const endTime = isFinished && console.endTime ? console.endTime : Date.now();
    const totalDurationMinutes = Math.max(1, differenceInMinutes(endTime, console.startTime));
    const totalCost = Math.ceil((totalDurationMinutes / 60) * console.hourlyRate);

    const historyEntry: RentalHistory = {
      id: Math.random().toString(36).substr(2, 9),
      consoleId: console.id,
      consoleName: console.name,
      customerName: console.customerName || 'Guest',
      startTime: console.startTime,
      endTime,
      totalDurationMinutes,
      totalCost,
      fnbCost: totalSalesAmount,
      totalBill: totalCurrentBill,
      hourlyRate: console.hourlyRate,
    };

    setLastRentalHistory(historyEntry);
    setShowPaymentModal(true);
    onPay(historyEntry);
  };

  return (
      <div className={cn(
        "relative bg-white rounded-[2rem] p-6 border transition-all duration-300",
        isPlaying ? "border-indigo-100 shadow-xl shadow-indigo-50" : 
        isFinished ? "border-emerald-100 shadow-xl shadow-emerald-50" :
        "border-gray-100 shadow-sm hover:shadow-md"
      )}>
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
            isPlaying 
              ? (isTimeUp ? "bg-red-50 text-red-600 animate-pulse" : "bg-indigo-50 text-indigo-600") 
              : isFinished ? "bg-emerald-50 text-emerald-600" : "bg-emerald-50 text-emerald-600"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? (isTimeUp ? "bg-red-600" : "bg-indigo-600") : "bg-emerald-600")} />
            {isPlaying ? (isTimeUp ? 'Time Up' : 'Playing') : isFinished ? 'Finished' : 'Available'}
          </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSaleModal(true)}
            className="p-2 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            title="Beli F&B"
          >
            <ShoppingCart size={16} />
          </button>
          <div className="text-xs font-bold text-gray-300">{console.type}</div>
        </div>
      </div>

      <AnimatePresence>
        {showSaleModal && (
          <SaleModal 
            console={console}
            products={products}
            onClose={() => setShowSaleModal(false)}
            onSale={(sale) => {
              onSale(sale);
              setShowSaleModal(false);
            }}
            settings={settings}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && lastRentalHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Pembayaran Berhasil!</h3>
              <p className="text-gray-500 mb-8">Rental {lastRentalHistory.consoleName} selesai. Total: Rp {lastRentalHistory.totalBill.toLocaleString()}</p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => window.print()}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
                >
                  <Printer size={20} />
                  Cetak Nota (58mm)
                </button>
                <button 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setLastRentalHistory(null);
                  }}
                  className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Tutup
                </button>
              </div>

              <RentalReceipt history={lastRentalHistory} settings={settings} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6">
        <h3 className="text-xl font-black text-gray-900 mb-1">{console.name}</h3>
        {isPlaying ? (
          <div className="flex items-center gap-2 text-gray-400">
            <UserIcon size={14} />
            <span className="text-sm font-medium">{console.customerName}</span>
          </div>
        ) : (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-tight">Rp {console.hourlyRate.toLocaleString()} / Jam</p>
        )}
      </div>

      {(isPlaying || isFinished) ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Elapsed</p>
              <p className="text-xl font-black text-gray-900 tabular-nums">
                {formatTime(elapsedSeconds)}
              </p>
            </div>
            {remainingSeconds !== null && (
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Remaining</p>
                <p className={cn(
                  "text-xl font-black tabular-nums",
                  isTimeUp ? "text-red-600" : "text-indigo-600"
                )}>
                  {formatTime(remainingSeconds)}
                </p>
              </div>
            )}
          </div>

          {console.durationMinutes && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className={cn("h-full transition-colors", isTimeUp ? "bg-red-500" : "bg-indigo-600")}
                />
              </div>
            </div>
          )}

          <div className={cn(
            "p-4 rounded-2xl space-y-2 transition-all",
            isFinished ? "bg-emerald-100 border-2 border-emerald-200" : "bg-emerald-50"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-bold uppercase", isFinished ? "text-emerald-800" : "text-emerald-700")}>Rental</span>
              <span className={cn("text-sm font-bold", isFinished ? "text-emerald-800" : "text-emerald-700")}>Rp {currentRentalCost.toLocaleString()}</span>
            </div>
            {totalSalesAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-bold uppercase", isFinished ? "text-emerald-800" : "text-emerald-700")}>F&B / Snack</span>
                <span className={cn("text-sm font-bold", isFinished ? "text-emerald-800" : "text-emerald-700")}>Rp {totalSalesAmount.toLocaleString()}</span>
              </div>
            )}
            <div className={cn(
              "pt-2 border-t flex items-center justify-between",
              isFinished ? "border-emerald-300" : "border-emerald-200"
            )}>
              <span className={cn("text-xs font-black uppercase", isFinished ? "text-emerald-900" : "text-emerald-800")}>Tagihan</span>
              <span className={cn("text-lg font-black", isFinished ? "text-emerald-900" : "text-emerald-800")}>Rp {totalCurrentBill.toLocaleString()}</span>
            </div>
          </div>

          {/* Add Time Section */}
          {isPlaying && (
            <div className="flex gap-2">
              <input 
                type="number"
                value={extraMinutes}
                onChange={(e) => setExtraMinutes(e.target.value)}
                className="w-20 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Min"
              />
              <button 
                onClick={() => onAddTime(console.id, parseInt(extraMinutes) || 0)}
                className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors"
              >
                + Tambah Waktu
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {isPlaying ? (
              <button 
                onClick={() => onStop(console.id)}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <Square size={16} fill="currentColor" />
                Selesai
              </button>
            ) : (
              <button 
                onClick={handleBatalOrLanjut}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                {wasTimeUp ? <Plus size={16} /> : <Play size={16} fill="currentColor" />}
                {wasTimeUp ? 'Lanjut' : 'Batal'}
              </button>
            )}
            <button 
              onClick={handlePay}
              disabled={isPlaying && !isTimeUp}
              className={cn(
                "flex-1 py-4 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                (isFinished || isTimeUp) 
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" 
                  : "bg-gray-300 cursor-not-allowed shadow-none"
              )}
            >
              <DollarSign size={16} />
              Bayar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                placeholder="Nama Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                placeholder="Durasi (Menit) - Kosongkan untuk Open"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <button 
            onClick={() => onStart(console.id, customerName, duration ? parseInt(duration) : undefined)}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
          >
            <Play size={18} fill="currentColor" />
            Mulai Rental
          </button>
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
          : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface MobileNavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function MobileNavButton({ active, onClick, icon }: MobileNavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl transition-all",
        active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400"
      )}
    >
      {icon}
    </button>
  );
}
