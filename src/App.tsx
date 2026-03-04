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
  Users
} from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds, addMinutes, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';
import { Console, RentalHistory, Settings, User } from './types';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
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
    const totalDurationMinutes = Math.max(1, differenceInMinutes(endTime, console.startTime));
    const totalCost = Math.ceil((totalDurationMinutes / 60) * console.hourlyRate);

    const newHistoryEntry: RentalHistory = {
      id: Math.random().toString(36).substr(2, 9),
      consoleId: console.id,
      consoleName: console.name,
      customerName: console.customerName || 'Guest',
      startTime: console.startTime,
      endTime,
      totalDurationMinutes,
      totalCost,
      hourlyRate: console.hourlyRate,
    };

    setHistory(prev => [newHistoryEntry, ...prev]);
    
    // Control Relay
    controlRelay(console.relayId, 0);

    setConsoles(prev => prev.map(c => {
      if (c.id === consoleId) {
        return {
          ...c,
          status: 'available',
          startTime: undefined,
          durationMinutes: undefined,
          customerName: undefined
        };
      }
      return c;
    }));
  }, [consoles]);

  const stats = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const todayHistory = history.filter(h => h.startTime >= today);
    const totalRevenue = todayHistory.reduce((acc, curr) => acc + curr.totalCost, 0);
    const totalSessions = todayHistory.length;
    const activeConsoles = consoles.filter(c => c.status === 'playing').length;

    return { totalRevenue, totalSessions, activeConsoles };
  }, [history, consoles]);

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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Laporan Rental PlayStation', 14, 22);
    
    // Date
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`, 14, 30);
    
    // Stats
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Pendapatan: Rp ${history.reduce((acc, curr) => acc + curr.totalCost, 0).toLocaleString()}`, 14, 40);
    doc.text(`Total Sesi: ${history.length}`, 14, 47);

    // Table
    const tableData = history.map(item => [
      item.customerName,
      item.consoleName,
      `${format(item.startTime, 'dd/MM/yy HH:mm')} - ${format(item.endTime, 'HH:mm')}`,
      `${item.totalDurationMinutes} Menit`,
      `Rp ${item.totalCost.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Customer', 'Console', 'Waktu', 'Durasi', 'Biaya']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
    });

    doc.save(`Laporan_PS_Rental_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
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
            <h1 className="font-bold text-xl tracking-tight">PS Rental</h1>
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
              {activeTab === 'dashboard' && 'Console Dashboard'}
              {activeTab === 'history' && 'Laporan Penggunaan'}
              {activeTab === 'settings' && 'Pengaturan Sistem'}
            </h2>
            <p className="text-gray-500 text-sm">
              {activeTab === 'dashboard' && 'Pantau dan kelola timer rental secara real-time.'}
              {activeTab === 'history' && 'Riwayat transaksi dan pendapatan rental.'}
              {activeTab === 'settings' && 'Konfigurasi tarif dan daftar console.'}
            </p>
          </div>

          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-400 uppercase">Today's Revenue</span>
                <span className="text-xl font-bold text-emerald-600">Rp {stats.totalRevenue.toLocaleString()}</span>
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
                  currentTime={currentTime}
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
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Riwayat Transaksi</h3>
                <button 
                  onClick={exportToPDF}
                  disabled={history.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                >
                  <Download size={16} />
                  Export PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer / Console</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Durasi</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Biaya</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          Belum ada riwayat transaksi.
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
                            <p className="font-bold text-emerald-600">Rp {item.totalCost.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
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
  currentTime: number;
}

function ConsoleCard({ console, onStart, onStop, currentTime }: ConsoleCardProps) {
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState<string>(''); // in minutes

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isPlaying = console.status === 'playing';
  
  const elapsedSeconds = isPlaying && console.startTime 
    ? differenceInSeconds(currentTime, console.startTime) 
    : 0;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const remainingSeconds = isPlaying && console.startTime && console.durationMinutes
    ? Math.max(0, (console.durationMinutes * 60) - elapsedSeconds)
    : null;

  const progress = isPlaying && console.durationMinutes
    ? Math.min(100, (elapsedSeconds / (console.durationMinutes * 60)) * 100)
    : 0;

  const currentCost = isPlaying && console.startTime
    ? Math.ceil((Math.max(1, elapsedMinutes) / 60) * console.hourlyRate)
    : 0;

  const isTimeUp = remainingSeconds !== null && remainingSeconds === 0;

  return (
    <div className={cn(
      "relative bg-white rounded-[2rem] p-6 border transition-all duration-300",
      isPlaying ? "border-indigo-100 shadow-xl shadow-indigo-50" : "border-gray-100 shadow-sm hover:shadow-md"
    )}>
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-6">
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
          isPlaying 
            ? (isTimeUp ? "bg-red-50 text-red-600 animate-pulse" : "bg-indigo-50 text-indigo-600") 
            : "bg-emerald-50 text-emerald-600"
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? (isTimeUp ? "bg-red-600" : "bg-indigo-600") : "bg-emerald-600")} />
          {isPlaying ? (isTimeUp ? 'Time Up' : 'Playing') : 'Available'}
        </div>
        <div className="text-xs font-bold text-gray-300">{console.type}</div>
      </div>

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

      {isPlaying ? (
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

          <div className="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">Current Bill</span>
            <span className="text-lg font-black text-emerald-700">Rp {currentCost.toLocaleString()}</span>
          </div>

          <button 
            onClick={() => onStop(console.id)}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-lg shadow-gray-200"
          >
            <Square size={18} fill="currentColor" />
            Stop & Checkout
          </button>
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
