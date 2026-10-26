import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart3, Box, ArrowDownLeft, ArrowUpRight, History, Layers, 
  Search, Plus, Camera, Trash2, Eye, Download, CheckCircle2, 
  AlertTriangle, Clock, RefreshCw, Filter, User, Building2, Briefcase, 
  Calendar, ShieldAlert, Tag, Image as ImageIcon, MapPin, X, Sun, Moon,
  TrendingUp, PackageCheck, AlertCircle, FileText, PieChart as PieIcon,
  TrendingDown, RotateCcw, Check, Sparkles, Menu
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { fetchTickets, createInboundTicket, submitOutboundTicket, updateTicket, deleteTicket } from './api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);

  // Hàm load dữ liệu thật từ MongoDB Atlas qua Backend Cổng 5000
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchTickets();
      
      const invList = [];
      const logList = [];

      data.forEach(t => {
        const exported = t.totalExportedQuantity || 0;
        const currentQty = (t.inbound?.quantity || 0) - exported;

        invList.push({
          id: t._id,
          sku: t.sku || t.inbound?.sku || 'N/A',
          name: t.itemName,
          category: 'Vật tư Marketing',
          quantity: currentQty,
          unit: t.unit || 'Cái',
          minStock: 5,
          zone: t.inbound?.zone || 'Khu A',
          project: t.inbound?.project || 'P2P Project',
          department: t.inbound?.department || 'Marketing',
          keeper: t.inbound?.keeper || 'Kiên Đặng',
          condition: t.inbound?.condition || 'Mới 100%',
          entryDate: t.inbound?.timestamp ? t.inbound.timestamp.slice(0, 10) : '2026-10-01',
          storageDays: t.inbound?.storageDays || 60,
          imageUrl: t.inbound?.photoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600'
        });

        if (t.inbound) {
          logList.push({
            id: t._id + '-in',
            type: 'INBOUND',
            orderCode: t.ticketCode,
            sku: t.sku || t.inbound.sku,
            itemName: t.itemName,
            quantity: t.inbound.quantity,
            unit: t.unit,
            condition: t.inbound.condition,
            supplier: t.inbound.deliveryUnit || 'N/A',
            project: t.inbound.project,
            department: t.inbound.department,
            keeper: t.inbound.keeper,
            zone: t.inbound.zone,
            timestamp: new Date(t.inbound.timestamp).toLocaleString(),
            dateStr: new Date(t.inbound.timestamp).toLocaleDateString(),
            dateKey: t.inbound.timestamp ? new Date(t.inbound.timestamp).toISOString().slice(0, 10) : '',
            note: t.inbound.note || 'Nhập kho thành công',
            photo: t.inbound.photoUrl
          });
        }

        if (t.exportLogs && t.exportLogs.length > 0) {
          t.exportLogs.forEach((ex, idx) => {
            logList.push({
              id: t._id + '-out-' + idx,
              type: 'OUTBOUND',
              orderCode: t.ticketCode + `-EX${idx+1}`,
              sku: t.sku,
              itemName: t.itemName,
              quantity: ex.quantity,
              unit: t.unit,
              condition: ex.condition,
              receiver: ex.receiverName || ex.receiverDepartment,
              project: t.inbound?.project,
              department: ex.receiverDepartment,
              executor: ex.executor,
              timestamp: new Date(ex.timestamp).toLocaleString(),
              dateStr: new Date(ex.timestamp).toLocaleDateString(),
              dateKey: ex.timestamp ? new Date(ex.timestamp).toISOString().slice(0, 10) : '',
              note: ex.note || 'Xuất kho thành công',
              photo: ex.photoUrl
            });
          });
        }
      });

      setInventory(invList);
      setLogs(logList);
    } catch (err) {
      console.error("Lỗi kết nối Backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [activePhotoModal, setActivePhotoModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterCondition, setFilterCondition] = useState('ALL');

  const [inboundForm, setInboundForm] = useState({
    orderCode: 'IN-' + Math.floor(10000 + Math.random() * 90000),
    sku: '',
    name: '',
    category: 'Vật tư Marketing',
    quantity: 1,
    unit: 'Cái',
    minStock: 5,
    condition: 'Mới 100%',
    supplier: '',
    project: 'Sự kiện Ra mắt Sản phẩm Mới',
    department: 'Marketing',
    keeper: 'Kiên Đặng',
    zone: 'Khu A - Kệ A1',
    storageDays: 60,
    note: '',
    photo: null
  });

  const [outboundForm, setOutboundForm] = useState({
    orderCode: 'OUT-' + Math.floor(10000 + Math.random() * 90000),
    selectedSku: '',
    quantity: 1,
    condition: 'Tốt / Đã đóng gói',
    receiver: '',
    project: 'Sự kiện Ra mắt Sản phẩm Mới',
    department: 'Marketing',
    approver: 'Trần Văn Quản Lý',
    executor: 'Kiên Đặng',
    note: '',
    photo: null
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null);
  const videoRef = useRef(null);

  const startCamera = async (target) => {
    setCameraTarget(target);
    setIsCameraActive(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn("Camera fallback", err);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      alert('Camera chưa sẵn sàng. Vui lòng bật camera và thử lại.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      alert('Không thể xử lý ảnh từ camera. Vui lòng tải ảnh lên từ thiết bị.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (cameraTarget === 'inbound') {
      setInboundForm(prev => ({ ...prev, photo: photoDataUrl }));
    } else if (cameraTarget === 'outbound') {
      setOutboundForm(prev => ({ ...prev, photo: photoDataUrl }));
    }
    stopCamera();
  };

  const handleFileUpload = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'inbound') setInboundForm(prev => ({ ...prev, photo: reader.result }));
        else setOutboundForm(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
    setCameraTarget(null);
  };

const getCurrentFormattedDate = () => {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : n);
    return {
      full: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      dateOnly: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      dateStr: `${pad(now.getMonth() + 1)}/${pad(now.getDate())}`
    };
  };

  const todayStr = getCurrentFormattedDate().dateOnly;

  const handleInboundSubmit = async (e) => {
    e.preventDefault();
    if (!inboundForm.sku || !inboundForm.name || inboundForm.quantity <= 0) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        sku: inboundForm.sku.toUpperCase(),
        itemName: inboundForm.name,
        unit: inboundForm.unit,
        quantity: Number(inboundForm.quantity),
        condition: inboundForm.condition,
        deliveryUnit: inboundForm.supplier,
        department: inboundForm.department,
        project: inboundForm.project,
        keeper: inboundForm.keeper,
        zone: inboundForm.zone,
        storageDays: Number(inboundForm.storageDays),
        note: inboundForm.note,
        photoUrl: inboundForm.photo
      };

      await createInboundTicket(payload);
      alert("✅ Nhập kho thành công và đã lưu lên MongoDB Atlas!");
      loadData();
      setActiveTab('overview');
    } catch (err) {
      alert("❌ Lỗi khi lưu vào MongoDB: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOutboundSubmit = async (e) => {
    e.preventDefault();
    if (!outboundForm.selectedSku || outboundForm.quantity <= 0) {
      alert("Vui lòng chọn mã sản phẩm và nhập số lượng xuất hợp lệ!");
      return;
    }

    try {
      setLoading(true);
      // Lấy ticket gốc theo SKU để gửi đúng ID lên backend.
      const allRawTickets = await fetchTickets();
      const targetTicket = allRawTickets.find(t => (t.sku === outboundForm.selectedSku || t.inbound?.sku === outboundForm.selectedSku));

      if (!targetTicket) {
        alert("Sản phẩm không tồn tại trong cơ sở dữ liệu!");
        return;
      }

      const availableQty = (Number(targetTicket.inbound?.quantity) || 0) - (Number(targetTicket.totalExportedQuantity) || 0);
      if (Number(outboundForm.quantity) > availableQty) {
        alert(`Số lượng xuất (${outboundForm.quantity}) vượt tồn kho hiện tại (${availableQty}).`);
        return;
      }

      const payload = {
        quantity: Number(outboundForm.quantity),
        condition: outboundForm.condition,
        receiverDepartment: outboundForm.department,
        receiverName: outboundForm.receiver,
        executor: outboundForm.executor,
        note: outboundForm.note,
        photoUrl: outboundForm.photo
      };

      await submitOutboundTicket(targetTicket._id, payload);
      alert("✅ Xuất kho thành công và cập nhật lên MongoDB Atlas!");
      loadData();
      setActiveTab('overview');
    } catch (err) {
      alert("❌ Lỗi xuất kho: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

const handleExportCSV = () => {
    // Biến csvContent được khai báo cục bộ CHÍNH XÁC BÊN TRONG HÀM NÀY
    let csvContent = "\uFEFFID,SKU,TenHang,DanhMuc,SoLuong,DonVi,TinhTrang,KhuVuc,DuAn,PhongBan,NgayNhap,LinkAnh\n";
    
    inventory.forEach(row => {
      const cleanName = (row.name || '').replace(/"/g, '""');
      const cleanZone = (row.zone || '').replace(/"/g, '""');
      const cleanProject = (row.project || '').replace(/"/g, '""');
      const cleanDept = (row.department || '').replace(/"/g, '""');
      
      const imgLink = row.imageUrl ? `=HYPERLINK("${row.imageUrl}", "Xem ảnh")` : "Không có";
      
      csvContent += `"${row.id}","${row.sku}","${cleanName}","${row.category}",${row.quantity},"${row.unit}","${row.condition}","${cleanZone}","${cleanProject}","${cleanDept}","${row.entryDate}","${imgLink}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `P2P_Bao_Cao_Kho_${new Date().toISOString().slice(0, 10)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  
  // Tổng số lượng hàng đang tồn kho (cộng số lượng của tất cả SKU).
  const totalItemsCount = useMemo(() => {
    return inventory.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  }, [inventory]);

  // Đếm số SKU có tồn kho chạm/vượt xuống dưới định mức tối thiểu.
  const lowStockCount = useMemo(() => {
    return inventory.filter(item => {
      const quantity = Number(item.quantity) || 0;
      const minStock = Number(item.minStock ?? 5);
      return quantity <= minStock;
    }).length;
  }, [inventory]);

  const overdueItemsCount = useMemo(() => {
    const today = new Date();
    return inventory.filter(item => {
      if (!item.entryDate) return false;
      const entry = new Date(item.entryDate);
      const expiry = new Date(entry.setDate(entry.getDate() + (item.storageDays || 60)));
      return expiry < today;
    }).length;
  }, [inventory]);

  const todayInboundCount = useMemo(() => logs.filter(l => l.type === 'INBOUND' && l.dateKey === todayStr).length, [logs, todayStr]);
  const todayOutboundCount = useMemo(() => logs.filter(l => l.type === 'OUTBOUND' && l.dateKey === todayStr).length, [logs, todayStr]);

  const uniqueProjectsCount = useMemo(() => new Set(inventory.map(i => i.project)).size, [inventory]);
  const uniqueDeptsCount = useMemo(() => new Set(inventory.map(i => i.department)).size, [inventory]);

  const trendChartData = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const d = log.dateStr || log.timestamp.split(' ')[0];
      if (!map[d]) map[d] = { date: d, inbound: 0, outbound: 0 };
      if (log.type === 'INBOUND') map[d].inbound += log.quantity;
      else map[d].outbound += log.quantity;
    });
    return Object.values(map);
  }, [logs]);

  const departmentChartData = useMemo(() => {
    const map = {};
    inventory.forEach(item => {
      map[item.department] = (map[item.department] || 0) + item.quantity;
    });
    return Object.keys(map).map(dept => ({ name: dept, value: map[dept] }));
  }, [inventory]);

  const conditionChartData = useMemo(() => {
    const map = {};
    inventory.forEach(item => {
      map[item.condition] = (map[item.condition] || 0) + item.quantity;
    });
    return Object.keys(map).map(cond => ({ name: cond, quantity: map[cond] }));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const query = searchTerm.toLowerCase();
      const matchSearch = String(item.name || '').toLowerCase().includes(query) ||
                          String(item.sku || '').toLowerCase().includes(query) ||
                          String(item.id || '').toLowerCase().includes(query);
      const matchDept = filterDepartment === 'ALL' || item.department === filterDepartment;
      const matchCondition = filterCondition === 'ALL' || item.condition === filterCondition;
      return matchSearch && matchDept && matchCondition;
    });
  }, [inventory, searchTerm, filterDepartment, filterCondition]);

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-200 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      
      {/* MOBILE HEADER BAR */}
      <div className="md:hidden flex items-center justify-between bg-[#0f172a] text-white p-4 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Box className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-base tracking-wider text-white">P2P WMS</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className={`w-full md:w-64 p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r bg-[#0f172a] text-slate-300 ${mobileMenuOpen ? 'block' : 'hidden md:flex'}`}>
        <div>
          {/* Logo Header */}
          <div className="hidden md:flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight tracking-wider text-white">P2P WMS</h1>
              <p className="text-[11px] text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3 h-3" /> P2P Warehouse System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Tổng Quan Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveTab('inbound'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'inbound'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>Quy Trình Nhập Kho</span>
            </button>

            <button
              onClick={() => { setActiveTab('outbound'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'outbound'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <span>Quy Trình Xuất Kho</span>
            </button>

            <button
              onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Quản Lý Tồn Kho</span>
              {lowStockCount > 0 && (
                <span className="ml-auto bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('logs'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Nhật Ký Realtime</span>
            </button>
          </nav>
        </div>

        {/* Footer Settings */}
        <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-400">P2P Logistics v2.6</span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition flex items-center gap-1 text-[11px]"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            <span>{darkMode ? 'Sáng' : 'Tối'}</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">

        {/* TOP BAR / HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className={`text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {activeTab === 'overview' && '📊 Dashboard Quản Lý Kho P2P & Biểu Đồ Realtime'}
              {activeTab === 'inbound' && '📥 Quy Trình Nhập Kho Hàng Hóa P2P'}
              {activeTab === 'outbound' && '📤 Quy Trình Xuất Kho Hàng Hóa P2P'}
              {activeTab === 'inventory' && '📦 Danh Mục Quản Lý Tồn Kho P2P'}
              {activeTab === 'logs' && '📋 Nhật Ký Giao Nhận P2P & Audit Trail'}
            </h2>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Đồng bộ dữ liệu nhập/xuất kho liên tục kết nối trực tiếp với MongoDB Atlas
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-xl transition shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo CSV/Excel</span>
            </button>
          </div>
        </header>

        {/* TAB 1: REALTIME DASHBOARD & ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* KPI Cards Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Tổng Hàng Tồn Kho</p>
                    <h3 className="text-3xl font-extrabold mt-2 text-indigo-600 dark:text-indigo-400">{totalItemsCount}</h3>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Box className="w-6 h-6" />
                  </div>
                </div>
                <p className={`text-xs mt-3 flex items-center gap-1 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Phân bổ qua {inventory.length} mã SKU P2P
                </p>
              </div>

              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Giao Dịch Hôm Nay</p>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-lg sm:text-xl font-bold text-emerald-600">+{todayInboundCount} nhập</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-lg sm:text-xl font-bold text-amber-500">-{todayOutboundCount} xuất</span>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
                <p className={`text-xs mt-3 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Cập nhật thời gian thực
                </p>
              </div>

              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Cảnh Báo Tồn Kho</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-xl sm:text-2xl font-extrabold text-amber-500">{lowStockCount} Sắp hết</span>
                      <span className="text-xs text-slate-500">| {overdueItemsCount} Quá hạn</span>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
                <p className={`text-xs mt-3 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Chạm định mức min & thời gian lưu
                </p>
              </div>

              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Dự Án / Phòng Ban</p>
                    <h3 className="text-3xl font-extrabold mt-2 text-sky-600 dark:text-sky-400">{uniqueProjectsCount} <span className="text-xs font-normal text-slate-500">dự án</span></h3>
                  </div>
                  <div className="p-3 bg-sky-50 dark:bg-sky-950/50 rounded-xl text-sky-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                </div>
                <p className={`text-xs mt-3 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Thuộc {uniqueDeptsCount} phòng ban gửi kho
                </p>
              </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      Xu Hướng Biến Động Nhập vs Xuất P2P
                    </h3>
                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Số lượng sản phẩm luân chuyển thực tế</p>
                  </div>
                </div>
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <defs>
                        <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: '1px solid #334155' }} />
                      <Area type="monotone" dataKey="inbound" name="Nhập Kho" stroke="#10b981" fillOpacity={1} fill="url(#colorInbound)" />
                      <Area type="monotone" dataKey="outbound" name="Xuất Kho" stroke="#f59e0b" fillOpacity={1} fill="url(#colorOutbound)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs flex flex-col justify-between`}>
                <div>
                  <h3 className={`font-bold text-sm sm:text-base mb-1 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <PieIcon className="w-5 h-5 text-indigo-500" />
                    Phân Bổ Hàng Tồn Theo Phòng Ban
                  </h3>
                  <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Tỷ lệ lưu trữ kho hiện tại</p>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {departmentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {departmentChartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>{entry.name}: <b>{entry.value}</b></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS & AUDIT TRAIL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                  <h3 className={`font-bold text-sm sm:text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <PackageCheck className="w-5 h-5 text-indigo-500" />
                    Tạo Đơn Giao Dịch Kho P2P
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveTab('inbound')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition"
                    >
                      <ArrowDownLeft className="w-6 h-6 mb-1 text-emerald-600" />
                      <span className="font-bold text-xs text-center">Tạo Đơn Nhập</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('outbound')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition"
                    >
                      <ArrowUpRight className="w-6 h-6 mb-1 text-amber-600" />
                      <span className="font-bold text-xs text-center">Tạo Đơn Xuất</span>
                    </button>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                  <h3 className={`font-bold text-sm sm:text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Tag className="w-5 h-5 text-indigo-500" />
                    Tình Trạng Hàng Hóa P2P
                  </h3>
                  <div className="space-y-2">
                    {conditionChartData.map((item) => (
                      <div key={item.name} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                        <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.name}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.quantity} sản phẩm</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`lg:col-span-2 p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <History className="w-5 h-5 text-indigo-500" />
                    Hoạt Động Nhập / Xuất Kho Mới Nhất
                  </h3>
                  <button onClick={() => setActiveTab('logs')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                    Xem toàn bộ log
                  </button>
                </div>

                <div className="space-y-3">
                  {logs.slice(0, 4).map((log) => (
                    <div key={log.id} className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} flex items-start gap-3`}>
                      <div className={`p-2 rounded-lg shrink-0 ${log.type === 'INBOUND' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'}`}>
                        {log.type === 'INBOUND' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.type === 'INBOUND' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            {log.type === 'INBOUND' ? 'NHẬP KHO' : 'XUẤT KHO'} • {log.orderCode}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.timestamp}
                          </span>
                        </div>
                        <h4 className={`text-sm font-semibold mt-1 truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{log.itemName} ({log.sku})</h4>
                        <div className={`text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          <span>Số lượng: <b className={darkMode ? 'text-slate-200' : 'text-slate-800'}>{log.quantity} {log.unit}</b></span>
                          <span>Dự án: <b className={darkMode ? 'text-slate-200' : 'text-slate-800'}>{log.project}</b></span>
                          <span>Phòng ban: <b className={darkMode ? 'text-slate-200' : 'text-slate-800'}>{log.department}</b></span>
                        </div>
                      </div>
                      {log.photo && (
                        <img 
                          src={log.photo} 
                          alt="Proof" 
                          onClick={() => setActivePhotoModal(log.photo)}
                          className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition border border-slate-300 dark:border-slate-700 shrink-0" 
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INBOUND FORM */}
        {activeTab === 'inbound' && (
          <div className={`p-5 sm:p-6 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs max-w-4xl mx-auto`}>
            <form onSubmit={handleInboundSubmit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-6 h-6 text-emerald-500" />
                  <h3 className={`text-base sm:text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Phiếu Nhập Kho Hàng Hóa P2P</h3>
                </div>
                <span className={`text-xs font-mono px-3 py-1 rounded-md ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
                  Mã phiếu: <b>{inboundForm.orderCode}</b>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Mã SKU / Mã Sản Phẩm *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: MKT-POSM-01"
                    value={inboundForm.sku}
                    onChange={e => setInboundForm({ ...inboundForm, sku: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tên Hàng Hóa *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Standee Khung X Triển Lãm"
                    value={inboundForm.name}
                    onChange={e => setInboundForm({ ...inboundForm, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Danh Mục Hàng Hóa</label>
                  <select
                    value={inboundForm.category}
                    onChange={e => setInboundForm({ ...inboundForm, category: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="Vật tư Marketing">Vật tư Marketing</option>
                    <option value="Thiết bị Công nghệ">Thiết bị Công nghệ</option>
                    <option value="Quà tặng / Event">Quà tặng / Event</option>
                    <option value="Văn phòng phẩm">Văn phòng phẩm</option>
                    <option value="Dụng cụ Kỹ thuật">Dụng cụ Kỹ thuật</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Số Lượng Nhập *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={inboundForm.quantity}
                      onChange={e => setInboundForm({ ...inboundForm, quantity: e.target.value })}
                      className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Đơn Vị Tính</label>
                    <input
                      type="text"
                      placeholder="Cái, Thùng, Bộ..."
                      value={inboundForm.unit}
                      onChange={e => setInboundForm({ ...inboundForm, unit: e.target.value })}
                      className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tình Trạng Hàng Nhận</label>
                  <select
                    value={inboundForm.condition}
                    onChange={e => setInboundForm({ ...inboundForm, condition: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="Mới 100%">Mới 100%</option>
                    <option value="Nguyên seal">Nguyên seal</option>
                    <option value="Trầy xước nhẹ">Trầy xước nhẹ</option>
                    <option value="Cần kiểm tra lại">Cần kiểm tra lại</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Nhà Cung Cấp</label>
                  <input
                    type="text"
                    placeholder="VD: Cty In ấn Á Châu"
                    value={inboundForm.supplier}
                    onChange={e => setInboundForm({ ...inboundForm, supplier: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Thuộc Dự Án</label>
                  <input
                    type="text"
                    placeholder="VD: Sự kiện Ra mắt Sản phẩm Q4"
                    value={inboundForm.project}
                    onChange={e => setInboundForm({ ...inboundForm, project: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Phòng Ban</label>
                  <select
                    value={inboundForm.department}
                    onChange={e => setInboundForm({ ...inboundForm, department: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="Marketing">Marketing</option>
                    <option value="Kỹ thuật">Kỹ thuật</option>
                    <option value="Sự kiện">Sự kiện</option>
                    <option value="Mua hàng (Purchasing)">Mua hàng (Purchasing)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Thủ Kho Đảm Nhiệm</label>
                  <input
                    type="text"
                    placeholder="VD: Kiên Đặng"
                    value={inboundForm.keeper}
                    onChange={e => setInboundForm({ ...inboundForm, keeper: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Vị Trí Kho (Zone / Rack)</label>
                  <input
                    type="text"
                    placeholder="VD: Khu A - Kệ A1"
                    value={inboundForm.zone}
                    onChange={e => setInboundForm({ ...inboundForm, zone: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-bold uppercase mb-1 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Ghi Chú Đơn Nhập</label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú thêm về quy cách đóng gói..."
                  value={inboundForm.note}
                  onChange={e => setInboundForm({ ...inboundForm, note: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                ></textarea>
              </div>

              {/* CAMERA / IMAGE UPLOAD ATTACHMENT */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <label className={`block font-bold uppercase mb-2 text-xs flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Camera className="w-4 h-4 text-indigo-500" />
                  Ảnh Chụp Chứng Từ / Thực Tế Hàng Nhập
                </label>

                {isCameraActive && cameraTarget === 'inbound' ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video max-w-md mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Chụp Ảnh
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2 bg-slate-600 text-white font-medium text-xs rounded-lg"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {inboundForm.photo ? (
                      <div className="relative group">
                        <img src={inboundForm.photo} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-300 dark:border-slate-700" />
                        <button
                          type="button"
                          onClick={() => setInboundForm({ ...inboundForm, photo: null })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">Chưa có ảnh</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera('inbound')}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm"
                      >
                        <Camera className="w-4 h-4" /> Chụp Bằng Camera
                      </button>

                      <label className="px-3.5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Tải File Ảnh
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'inbound')} />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-xs sm:text-sm flex items-center gap-2 transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Xác Nhận Nhập Kho P2P
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: OUTBOUND FORM */}
        {activeTab === 'outbound' && (
          <div className={`p-5 sm:p-6 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs max-w-4xl mx-auto`}>
            <form onSubmit={handleOutboundSubmit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-6 h-6 text-amber-500" />
                  <h3 className={`text-base sm:text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Phiếu Xuất Kho Hàng Hóa P2P</h3>
                </div>
                <span className={`text-xs font-mono px-3 py-1 rounded-md ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
                  Mã phiếu: <b>{outboundForm.orderCode}</b>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Chọn Hàng Hóa Cần Xuất *</label>
                  <select
                    required
                    value={outboundForm.selectedSku}
                    onChange={e => setOutboundForm({ ...outboundForm, selectedSku: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="">-- Chọn mặt hàng trong kho P2P --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.sku}>
                        {item.name} ({item.sku}) — Tồn khả dụng: {item.quantity} {item.unit} | Vị trí: {item.zone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Số Lượng Xuất *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={outboundForm.quantity}
                    onChange={e => setOutboundForm({ ...outboundForm, quantity: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tình Trạng Hàng Khi Bàn Giao</label>
                  <select
                    value={outboundForm.condition}
                    onChange={e => setOutboundForm({ ...outboundForm, condition: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="Tốt / Đã đóng gói">Tốt / Đã đóng gói</option>
                    <option value="Đã kiểm tra hoạt động">Đã kiểm tra hoạt động</option>
                    <option value="Hàng trả lại NCC">Hàng trả lại NCC</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Đơn Vị / Người Nhận Hàng</label>
                  <input
                    type="text"
                    placeholder="VD: Phạm Minh Tuấn"
                    value={outboundForm.receiver}
                    onChange={e => setOutboundForm({ ...outboundForm, receiver: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Thuộc Dự Án</label>
                  <input
                    type="text"
                    placeholder="VD: Triển Lãm Công Nghệ"
                    value={outboundForm.project}
                    onChange={e => setOutboundForm({ ...outboundForm, project: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-bold uppercase mb-1 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Ghi Chú Xuất Kho</label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú lý do xuất..."
                  value={outboundForm.note}
                  onChange={e => setOutboundForm({ ...outboundForm, note: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                ></textarea>
              </div>

              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <label className={`block font-bold uppercase mb-2 text-xs flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Camera className="w-4 h-4 text-amber-500" />
                  Ảnh Chụp Bàn Giao Hàng Xuất Realtime
                </label>

                {isCameraActive && cameraTarget === 'outbound' ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video max-w-md mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Chụp Ảnh Bàn Giao
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2 bg-slate-600 text-white font-medium text-xs rounded-lg"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {outboundForm.photo ? (
                      <div className="relative group">
                        <img src={outboundForm.photo} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-300 dark:border-slate-700" />
                        <button
                          type="button"
                          onClick={() => setOutboundForm({ ...outboundForm, photo: null })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">Chưa có ảnh</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera('outbound')}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm"
                      >
                        <Camera className="w-4 h-4" /> Bật Camera Chụp
                      </button>

                      <label className="px-3.5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Tải File Ảnh
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'outbound')} />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 text-xs sm:text-sm flex items-center gap-2 transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Xác Nhận Xuất Kho P2P
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: INVENTORY LIST */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs flex flex-col md:flex-row gap-3 justify-between items-center`}>
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hàng, SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-xl border outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
                <select
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                  className={`px-3 py-2 rounded-xl border outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                >
                  <option value="ALL">Tất cả Phòng Ban</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Kỹ thuật">Kỹ thuật</option>
                  <option value="Sự kiện">Sự kiện</option>
                </select>

                <select
                  value={filterCondition}
                  onChange={e => setFilterCondition(e.target.value)}
                  className={`px-3 py-2 rounded-xl border outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                >
                  <option value="ALL">Tất cả Tình Trạng</option>
                  <option value="Mới 100%">Mới 100%</option>
                  <option value="Nguyên seal">Nguyên seal</option>
                  <option value="Trầy xước nhẹ">Trầy xước nhẹ</option>
                </select>
              </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b font-semibold uppercase tracking-wider ${darkMode ? 'bg-slate-900/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                      <th className="p-3.5">Ảnh</th>
                      <th className="p-3.5">Mã SKU</th>
                      <th className="p-3.5">Tên Hàng Hóa</th>
                      <th className="p-3.5">Số Lượng Tồn</th>
                      <th className="p-3.5">Tình Trạng</th>
                      <th className="p-3.5">Vị Trí (Zone)</th>
                      <th className="p-3.5">Dự Án / Phòng Ban</th>
                      <th className="p-3.5">Thủ Kho</th>
                      <th className="p-3.5 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700/50 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-8 text-center text-slate-400">
                          Không tìm thấy hàng hóa nào trong kho P2P.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((item) => {
                        const isLow = item.quantity <= item.minStock;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition ${isLow ? 'bg-amber-500/5' : ''}`}>
                            <td className="p-3.5">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                onClick={() => setActivePhotoModal(item.imageUrl)}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80" 
                              />
                            </td>
                            <td className="p-3.5 font-mono font-bold">
                              <div>{item.sku}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{item.id}</div>
                            </td>
                            <td className="p-3.5 font-semibold">
                              {item.name}
                              <span className="block text-[10px] text-slate-400 font-normal">{item.category}</span>
                            </td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${isLow ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                {item.quantity} {item.unit}
                                {isLow && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">Min: {item.minStock}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px]">
                                {item.condition}
                              </span>
                            </td>
                            <td className="p-3.5 font-medium">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-indigo-500" />
                                {item.zone}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="font-medium">{item.project}</div>
                              <div className="text-[10px] text-slate-400">{item.department}</div>
                            </td>
                            <td className="p-3.5 text-slate-500">{item.keeper}</td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => {
                                  setOutboundForm(prev => ({ ...prev, selectedSku: item.sku }));
                                  setActiveTab('outbound');
                                }}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg hover:bg-indigo-100 text-[11px]"
                              >
                                Xuất hàng
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} shadow-2xs`}>
              <h3 className={`text-base font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                <History className="w-5 h-5 text-indigo-500" />
                Nhật Ký Giao Nhận & Chứng Từ Lịch Sử P2P
              </h3>

              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/70 border-slate-700' : 'bg-slate-50 border-slate-200'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                    <div className="flex items-start gap-3.5 flex-1">
                      <div className={`p-2.5 rounded-xl shrink-0 mt-1 ${log.type === 'INBOUND' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {log.type === 'INBOUND' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${log.type === 'INBOUND' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-950'}`}>
                            {log.type === 'INBOUND' ? 'NHẬP KHO' : 'XUẤT KHO'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-500">{log.orderCode}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {log.timestamp}
                          </span>
                        </div>

                        <h4 className={`font-bold text-sm ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{log.itemName} ({log.sku})</h4>

                        <div className={`text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 pt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          <div>Số lượng: <b className={darkMode ? 'text-slate-200' : 'text-slate-800'}>{log.quantity} {log.unit}</b></div>
                          <div>Tình trạng: <b>{log.condition}</b></div>
                          <div>Dự án: <b>{log.project}</b></div>
                          <div>Phòng ban: <b>{log.department}</b></div>
                        </div>

                        {log.note && (
                          <p className="text-xs italic text-slate-400 pt-1">
                            "{log.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {log.photo && (
                      <div className="shrink-0 self-center md:self-auto">
                        <img
                          src={log.photo}
                          alt="Evidence"
                          onClick={() => setActivePhotoModal(log.photo)}
                          className="w-16 h-16 object-cover rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer hover:scale-105 transition shadow-sm"
                        />
                        <span className="block text-[10px] text-center text-slate-400 mt-1">Xem chứng từ</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- LIGHTBOX MODAL FOR IMAGE PREVIEW --- */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <button
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-3 right-3 p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-2 flex justify-center">
              <img src={activePhotoModal} alt="Enlarged proof" className="max-h-[80vh] w-auto object-contain rounded-lg" />
            </div>
            <div className="p-4 bg-slate-950 text-center text-xs text-slate-400">
              Hình ảnh thực tế đính kèm chứng từ kho P2P
            </div>
          </div>
        </div>
      )}

    </div>
  );
}