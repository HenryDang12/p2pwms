import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart3, Box, ArrowDownLeft, ArrowUpRight, History, Layers, 
  Search, Plus, Camera, Trash2, Eye, Download, CheckCircle2, 
  AlertTriangle, Clock, RefreshCw, Filter, User, Building2, Briefcase, 
  Calendar, ShieldAlert, Tag, Image as ImageIcon, MapPin, X, Sun, Moon,
  TrendingUp, PackageCheck, AlertCircle, FileText, PieChart as PieIcon,
  TrendingDown, RotateCcw, Check, Sparkles, Menu, LogOut, LockKeyhole, Users, UserPlus, ShieldCheck
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { fetchTickets, createInboundTicket, submitOutboundTicket, updateTicket, deleteTicket, login, getCurrentUser, logout, getAccessToken, setAccessToken, fetchUsers, createUser, updateUser, fetchJobs, createJob, fetchAssets, createAsset, returnAsset } from './api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({ fullName: '', email: '', password: '', role: 'production' });
  const [userFormError, setUserFormError] = useState('');

  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [jobForm, setJobForm] = useState({ jobCode: '', name: '', client: '', eventLocation: '', startDate: '', endDate: '', owner: '' });
  const [assetForm, setAssetForm] = useState({ assetCode: '', name: '', sku: '', serialNumber: '', category: 'Thiết bị', location: 'Kho P2P' });
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

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
    let mounted = true;
    const onSessionExpired = () => {
      if (!mounted) return;
      setCurrentUser(null);
      setAuthReady(true);
      setLoginError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener('p2p-wms-session-expired', onSessionExpired);
    (async () => {
      try {
        if (getAccessToken()) {
          const user = await getCurrentUser();
          if (mounted) setCurrentUser(user);
        }
      } catch {
        setAccessToken(null);
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();
    return () => { mounted = false; window.removeEventListener('p2p-wms-session-expired', onSessionExpired); };
  }, []);

  useEffect(() => {
    if (authReady && currentUser) loadData();
  }, [authReady, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin' && activeTab === 'users') {
      setUsersLoading(true);
      fetchUsers().then(setUsersList).catch(err => showNotification(err.response?.data?.error || 'Không tải được danh sách tài khoản.', 'error')).finally(() => setUsersLoading(false));
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    if (!currentUser || !['jobs', 'outbound'].includes(activeTab)) return;
    Promise.all([fetchJobs(), fetchAssets()]).then(([jobData, assetData]) => { setJobs(jobData); setAssets(assetData); }).catch(err => showNotification(err.response?.data?.error || 'Không tải được Job/thiết bị.', 'error'));
  }, [currentUser, activeTab]);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try { const created = await createJob(jobForm); setJobs(prev => [created, ...prev]); setJobForm({ jobCode: '', name: '', client: '', eventLocation: '', startDate: '', endDate: '', owner: '' }); showNotification('Đã tạo Job/Event.'); }
    catch (err) { showNotification(err.response?.data?.error || 'Không tạo được Job.', 'error'); }
  };
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    try { const created = await createAsset(assetForm); setAssets(prev => [created, ...prev]); setAssetForm({ assetCode: '', name: '', sku: '', serialNumber: '', category: 'Thiết bị', location: 'Kho P2P' }); showNotification('Đã đăng ký thiết bị.'); }
    catch (err) { showNotification(err.response?.data?.error || 'Không đăng ký được thiết bị.', 'error'); }
  };
  const handleAssetReturn = async (asset) => {
    const condition = window.prompt('Tình trạng khi hoàn kho: Tốt, Cần kiểm tra, hoặc Hư hỏng', 'Tốt');
    if (!condition) return;
    try { await returnAsset(asset._id, { condition }); setAssets(prev => prev.map(a => a._id === asset._id ? { ...a, status: condition === 'Hư hỏng' ? 'maintenance' : 'available', currentJob: null, condition } : a)); showNotification('Đã cập nhật hoàn kho thiết bị.'); }
    catch (err) { showNotification(err.response?.data?.error || 'Không hoàn kho được.', 'error'); }
  };

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
    jobId: '',
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
    jobId: '',
    department: 'Marketing',
    approver: 'Trần Văn Quản Lý',
    executor: 'Kiên Đặng',
    note: '',
    photo: null
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [cameraStream, setCameraStream] = useState(null);
  const [notification, setNotification] = useState(null);
  const videoRef = useRef(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message: String(message), type });
    window.clearTimeout(showNotification.timer);
    showNotification.timer = window.setTimeout(() => setNotification(null), 4200);
  };

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play?.().catch(() => {});
    }
  }, [cameraStream, isCameraActive]);

  const startCamera = async (target, facingMode = cameraFacingMode) => {
    // Dừng luồng cũ trước khi đổi camera để tránh camera bị chiếm dụng.
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setCameraTarget(target);
    setCameraFacingMode(facingMode);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ camera. Hãy dùng Chrome/Edge và HTTPS hoặc localhost.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setCameraStream(stream);
    } catch (err) {
      setIsCameraActive(false);
      setCameraStream(null);
      showNotification(
        err.name === 'NotAllowedError'
          ? 'Bạn chưa cấp quyền camera. Hãy cho phép camera trong thanh địa chỉ trình duyệt rồi thử lại.'
          : `Không mở được camera: ${err.message || 'Vui lòng kiểm tra thiết bị camera.'}`,
        'error'
      );
    }
  };

  const switchCamera = async () => {
    if (!cameraTarget) return;
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    await startCamera(cameraTarget, nextFacingMode);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      showNotification('Camera chưa sẵn sàng. Vui lòng đợi hình ảnh xuất hiện rồi chụp lại.', 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      showNotification('Không xử lý được ảnh. Bạn có thể tải ảnh từ thiết bị lên thay thế.', 'error');
      return;
    }

    // Camera trước được lật gương để ảnh chụp khớp với phần xem trước.
    if (cameraFacingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (cameraTarget === 'inbound') {
      setInboundForm(prev => ({ ...prev, photo: photoDataUrl }));
    } else if (cameraTarget === 'outbound') {
      setOutboundForm(prev => ({ ...prev, photo: photoDataUrl }));
    }
    stopCamera();
    showNotification('Đã chụp và đính kèm ảnh thành công.');
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
    const stream = cameraStream || videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStream(null);
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
      showNotification('Vui lòng điền đầy đủ thông tin bắt buộc.', 'error');
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
      // Clear form text after a successful add so old values are not reused accidentally.
      setInboundForm({
        orderCode: 'IN-' + Math.floor(10000 + Math.random() * 90000),
        sku: '', name: '', category: 'Vật tư Marketing', quantity: 1, unit: 'Cái',
        minStock: 5, condition: 'Mới 100%', supplier: '', project: '', jobId: '',
        department: 'Marketing', keeper: '', zone: '', storageDays: 60, note: '', photo: null
      });
      showNotification('Nhập kho thành công. Đã xóa nội dung biểu mẫu để nhập phiếu mới.', 'success');
      loadData();
      setActiveTab('overview');
    } catch (err) {
      showNotification('Không thể lưu phiếu nhập: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOutboundSubmit = async (e) => {
    e.preventDefault();
    if (!outboundForm.selectedSku || outboundForm.quantity <= 0) {
      showNotification('Vui lòng chọn hàng hóa và nhập số lượng xuất hợp lệ.', 'error');
      return;
    }

    try {
      setLoading(true);
      // Lấy ticket gốc theo SKU để gửi đúng ID lên backend.
      const allRawTickets = await fetchTickets();
      const targetTicket = allRawTickets.find(t => (t.sku === outboundForm.selectedSku || t.inbound?.sku === outboundForm.selectedSku));

      if (!targetTicket) {
        showNotification('Không tìm thấy sản phẩm trong cơ sở dữ liệu.', 'error');
        return;
      }

      const availableQty = (Number(targetTicket.inbound?.quantity) || 0) - (Number(targetTicket.totalExportedQuantity) || 0);
      if (Number(outboundForm.quantity) > availableQty) {
        showNotification(`Số lượng xuất (${outboundForm.quantity}) vượt tồn kho hiện tại (${availableQty}).`, 'error');
        return;
      }

      const payload = {
        quantity: Number(outboundForm.quantity),
        sku: targetTicket.sku,
        jobId: outboundForm.jobId || undefined,
        assetIds: selectedAssetIds,
        condition: outboundForm.condition,
        receiverDepartment: outboundForm.department,
        receiverName: outboundForm.receiver,
        executor: outboundForm.executor,
        note: outboundForm.note,
        photoUrl: outboundForm.photo
      };

      await submitOutboundTicket(targetTicket._id, payload);
      setSelectedAssetIds([]);
      // Clear form text after a successful add so the next outbound starts fresh.
      setOutboundForm({
        orderCode: 'OUT-' + Math.floor(10000 + Math.random() * 90000),
        selectedSku: '', quantity: 1, condition: 'Tốt / Đã đóng gói', receiver: '',
        project: '', jobId: '', department: 'Marketing', approver: '', executor: '',
        note: '', photo: null
      });
      showNotification('Xuất kho thành công. Tồn kho và Job/Event đã được cập nhật; biểu mẫu đã được xóa.', 'success');
      loadData();
      setActiveTab('overview');
    } catch (err) {
      showNotification('Không thể lưu phiếu xuất: ' + (err.response?.data?.error || err.message), 'error');
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

  const roleLabels = { admin: 'Admin', manager: 'Quản lý', warehouse: 'Thủ kho', production: 'Production' };
  const canManageInbound = ['admin', 'manager', 'warehouse'].includes(currentUser?.role);
  const canManageOutbound = ['admin', 'manager', 'warehouse'].includes(currentUser?.role);
  const isAdmin = currentUser?.role === 'admin';

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await login({ email: loginForm.email.trim(), password: loginForm.password });
      setCurrentUser(result.user);
      setLoginForm({ email: '', password: '' });
      setActiveTab('overview');
      showNotification(`Xin chào ${result.user.fullName}!`, 'success');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Không thể đăng nhập. Kiểm tra kết nối và thử lại.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      setAccessToken(null);
    } finally {
      setCurrentUser(null);
      setActiveTab('overview');
      setInventory([]);
      setLogs([]);
      setLoginError('');
      showNotification('Đã đăng xuất khỏi P2P WMS.', 'success');
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setUserFormError('');
    try {
      await createUser(userForm);
      setUserForm({ fullName: '', email: '', password: '', role: 'production' });
      setUsersList(await fetchUsers());
      showNotification('Đã tạo tài khoản nhân viên.', 'success');
    } catch (err) {
      setUserFormError(err.response?.data?.error || 'Không thể tạo tài khoản.');
    }
  };

  const handleToggleUser = async (user) => {
    try {
      await updateUser(user._id || user.id, { active: !user.active });
      setUsersList(await fetchUsers());
      showNotification(user.active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.error || 'Không thể cập nhật tài khoản.', 'error');
    }
  };

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

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-5 text-white">
        <div className="text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600"><Box className="h-7 w-7" /></div><p className="text-sm text-slate-300">Đang kiểm tra phiên đăng nhập P2P WMS...</p></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-950/50"><Box className="h-8 w-8" /></div>
            <h1 className="text-2xl font-black tracking-wide text-white">P2P WMS</h1>
            <p className="mt-2 text-sm text-slate-400">Đăng nhập hệ thống quản lý kho nội bộ</p>
          </div>
          <form onSubmit={handleLogin} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
            <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-300"><LockKeyhole className="h-5 w-5" /></div><div><h2 className="font-bold text-white">Đăng nhập</h2><p className="text-xs text-slate-400">Sử dụng tài khoản do Admin cấp</p></div></div>
            {loginError && <div role="alert" className="mb-4 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2.5 text-sm text-rose-200">{loginError}</div>}
            <label className="mb-1.5 block text-xs font-semibold text-slate-300" htmlFor="login-email">Email công ty</label>
            <input id="login-email" type="email" autoComplete="username" required maxLength={254} value={loginForm.email} onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))} className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" placeholder="ten@p2pmarketing.com.vn" />
            <label className="mb-1.5 block text-xs font-semibold text-slate-300" htmlFor="login-password">Mật khẩu</label>
            <input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={loginForm.password} onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))} className="mb-6 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" placeholder="Nhập mật khẩu" />
            <button type="submit" disabled={loginLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{loginLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{loginLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}</button>
            <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">Chỉ nhân sự được cấp tài khoản mới được truy cập. Mọi thao tác nghiệp vụ được xác thực tại máy chủ.</p>
          </form>
          <p className="mt-5 text-center text-[11px] text-slate-600">P2P Logistics · Warehouse Management System</p>
        </div>
      </div>
    );
  }

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

            {canManageInbound && <button
              onClick={() => { setActiveTab('inbound'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'inbound'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>Quy Trình Nhập Kho</span>
            </button>}

            {canManageOutbound && <button
              onClick={() => { setActiveTab('outbound'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'outbound'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <span>Quy Trình Xuất Kho</span>
            </button>}

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

            <button onClick={() => { setActiveTab('jobs'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${activeTab === 'jobs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <Briefcase className="w-4 h-4" /><span>Job/Event & Thiết bị</span>
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

            {isAdmin && <button
              onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Users className="w-4 h-4" />
              <span>Quản lý tài khoản</span>
            </button>}
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
              {activeTab === 'jobs' && '🗓️ Quản Lý Job/Event & Thiết Bị Theo Mã Riêng'}
              {activeTab === 'users' && '🛡️ Quản Lý Tài Khoản & Phân Quyền'}
            </h2>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Đồng bộ dữ liệu nhập/xuất kho liên tục kết nối trực tiếp với MongoDB Atlas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><ShieldCheck className="h-4 w-4" /></div>
              <div><p className="text-xs font-bold">{currentUser.fullName}</p><p className="text-[10px] text-slate-500">{roleLabels[currentUser.role] || currentUser.role}</p></div>
            </div>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-xl transition shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo CSV/Excel</span>
            </button>
            <button type="button" onClick={handleLogout} title="Đăng xuất" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Đăng xuất</span></button>
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
                  <div className={`grid gap-3 ${canManageInbound && canManageOutbound ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {canManageInbound && <button
                      onClick={() => setActiveTab('inbound')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition"
                    >
                      <ArrowDownLeft className="w-6 h-6 mb-1 text-emerald-600" />
                      <span className="font-bold text-xs text-center">Tạo Đơn Nhập</span>
                    </button>}

                    {canManageOutbound && <button
                      onClick={() => setActiveTab('outbound')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition"
                    >
                      <ArrowUpRight className="w-6 h-6 mb-1 text-amber-600" />
                      <span className="font-bold text-xs text-center">Tạo Đơn Xuất</span>
                    </button>}
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
                    <option value="Marketing">Marketing CS</option>.
                    <option value="Fop">Operation</option>
                    <option value="Client Service">Client Service</option>
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
                      <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraFacingMode === 'user' ? '-scale-x-100' : ''}`} />
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" /> Đổi {cameraFacingMode === 'user' ? 'sang camera sau' : 'sang camera trước'}
                      </button>
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
                    onChange={e => { setOutboundForm({ ...outboundForm, selectedSku: e.target.value }); setSelectedAssetIds([]); }}
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

                <div className="md:col-span-2">
                  <label className={`block font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Gắn với Job/Event (khuyến nghị)</label>
                  <select value={outboundForm.jobId} onChange={e => setOutboundForm({ ...outboundForm, jobId: e.target.value })} className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                    <option value="">-- Chọn Job/Event --</option>
                    {jobs.filter(j => !['completed','cancelled'].includes(j.status)).map(j => <option key={j._id} value={j._id}>{j.jobCode} — {j.name} {j.client ? `(${j.client})` : ''}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">Tạo Job/Event tại mục “Job/Event & Thiết bị”. Danh sách được tải khi mở mục đó.</p>
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

                {outboundForm.selectedSku && assets.some(a => a.sku === outboundForm.selectedSku && a.status === 'available') && (
                  <div className="md:col-span-2 rounded-xl border border-indigo-300/50 p-3">
                    <label className={`block font-bold mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Thiết bị quản lý theo mã riêng (không bắt buộc)</label>
                    <p className="text-[11px] text-slate-500 mb-2">Chọn từng thiết bị nếu đang xuất TV, màn hình, router, PC... Khi chọn thiết bị, số lượng xuất phải bằng số thiết bị đã chọn.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-auto">
                      {assets.filter(a => a.sku === outboundForm.selectedSku && a.status === 'available').map(a => <label key={a._id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-500/5"><input type="checkbox" checked={selectedAssetIds.includes(a._id)} onChange={e => { const next = e.target.checked ? [...selectedAssetIds, a._id] : selectedAssetIds.filter(id => id !== a._id); setSelectedAssetIds(next); if (next.length) setOutboundForm(prev => ({...prev, quantity: next.length})); }} /> <span className="font-mono">{a.assetCode}</span> — {a.name} {a.serialNumber ? `(${a.serialNumber})` : ''}</label>)}
                    </div>
                    {selectedAssetIds.length > 0 && <button type="button" onClick={() => { setSelectedAssetIds([]); }} className="mt-2 text-xs text-indigo-500">Bỏ chọn thiết bị ({selectedAssetIds.length})</button>}
                  </div>
                )}

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
                      <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraFacingMode === 'user' ? '-scale-x-100' : ''}`} />
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" /> Đổi {cameraFacingMode === 'user' ? 'sang camera sau' : 'sang camera trước'}
                      </button>
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
                  <option value="Production">Production</option>
                  <option value="Fop">Operation</option>
                  <option value="Sự kiện">Sự kiện</option>
                  <option value="Client Service">Client Service</option>
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
                              {canManageOutbound && <button
                                onClick={() => {
                                  setOutboundForm(prev => ({ ...prev, selectedSku: item.sku }));
                                  setActiveTab('outbound');
                                }}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg hover:bg-indigo-100 text-[11px]"
                              >
                                Xuất hàng
                              </button>}
                              {!canManageOutbound && <span className="text-[10px] text-slate-400">Chỉ xem</span>}
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

        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-indigo-500"/>Tạo Job / Event</h3>
              <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <input required minLength="3" placeholder="Mã Job (VD: MRD-2026-01)" value={jobForm.jobCode} onChange={e=>setJobForm({...jobForm,jobCode:e.target.value.toUpperCase()})} className="rounded-xl border p-3 bg-transparent"/>
                <input required placeholder="Tên Job/Event" value={jobForm.name} onChange={e=>setJobForm({...jobForm,name:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Nhãn hàng / Khách hàng" value={jobForm.client} onChange={e=>setJobForm({...jobForm,client:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Địa điểm tổ chức" value={jobForm.eventLocation} onChange={e=>setJobForm({...jobForm,eventLocation:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input type="date" aria-label="Ngày bắt đầu" value={jobForm.startDate} onChange={e=>setJobForm({...jobForm,startDate:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input type="date" aria-label="Ngày kết thúc" value={jobForm.endDate} onChange={e=>setJobForm({...jobForm,endDate:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Production phụ trách" value={jobForm.owner} onChange={e=>setJobForm({...jobForm,owner:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <button className="rounded-xl bg-indigo-600 text-white font-bold p-3 md:col-span-2">+ Tạo Job/Event</button>
              </form>
            </div>
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-emerald-500"/>Đăng ký thiết bị quản lý theo mã riêng</h3>
              <p className="text-xs text-slate-500 mb-4">Dành cho thiết bị tái sử dụng như TV, LED, PC, máy in photobooth, router. SKU phải khớp SKU mặt hàng đang có trong kho.</p>
              <form onSubmit={handleCreateAsset} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <input required placeholder="Mã tài sản (VD: TV-001)" value={assetForm.assetCode} onChange={e=>setAssetForm({...assetForm,assetCode:e.target.value.toUpperCase()})} className="rounded-xl border p-3 bg-transparent"/>
                <input required placeholder="Tên thiết bị" value={assetForm.name} onChange={e=>setAssetForm({...assetForm,name:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input required placeholder="SKU phải khớp mặt hàng kho" value={assetForm.sku} onChange={e=>setAssetForm({...assetForm,sku:e.target.value.toUpperCase()})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Serial number (nếu có)" value={assetForm.serialNumber} onChange={e=>setAssetForm({...assetForm,serialNumber:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Nhóm thiết bị" value={assetForm.category} onChange={e=>setAssetForm({...assetForm,category:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <input placeholder="Vị trí kho" value={assetForm.location} onChange={e=>setAssetForm({...assetForm,location:e.target.value})} className="rounded-xl border p-3 bg-transparent"/>
                <button className="rounded-xl bg-emerald-600 text-white font-bold p-3 md:col-span-3">+ Đăng ký thiết bị</button>
              </form>
            </div>
            <div className={`p-5 rounded-2xl border overflow-x-auto ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-lg mb-4">Danh sách Job/Event ({jobs.length})</h3>
              <table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-3">Mã Job</th><th className="p-3">Tên Job</th><th className="p-3">Khách hàng</th><th className="p-3">Địa điểm</th><th className="p-3">Trạng thái</th></tr></thead><tbody>{jobs.map(j=><tr key={j._id} className="border-b border-slate-200/30"><td className="p-3 font-mono">{j.jobCode}</td><td className="p-3">{j.name}</td><td className="p-3">{j.client || '—'}</td><td className="p-3">{j.eventLocation || '—'}</td><td className="p-3"><span className="rounded-full bg-indigo-500/10 px-2 py-1">{{planning:'Chuẩn bị',active:'Đang chạy',completed:'Hoàn tất',cancelled:'Đã hủy'}[j.status] || j.status}</span></td></tr>)}</tbody></table>
            </div>
            <div className={`p-5 rounded-2xl border overflow-x-auto ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-lg mb-4">Thiết bị tái sử dụng ({assets.length})</h3>
              <table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-3">Mã tài sản</th><th className="p-3">Thiết bị</th><th className="p-3">SKU</th><th className="p-3">Serial</th><th className="p-3">Job hiện tại</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{assets.map(a=><tr key={a._id} className="border-b border-slate-200/30"><td className="p-3 font-mono">{a.assetCode}</td><td className="p-3">{a.name}</td><td className="p-3">{a.sku}</td><td className="p-3">{a.serialNumber || '—'}</td><td className="p-3">{a.currentJob?.jobCode || '—'}</td><td className="p-3">{{available:'Trong kho',assigned:'Đang ở Job',maintenance:'Bảo trì',retired:'Ngừng sử dụng'}[a.status] || a.status}</td><td className="p-3">{a.status === 'assigned' && <button onClick={()=>handleAssetReturn(a)} className="rounded-lg bg-emerald-600 text-white px-3 py-1">Hoàn kho</button>}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <form onSubmit={handleCreateUser} className={`h-fit rounded-2xl border p-5 sm:p-6 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'} shadow-sm`}>
              <h3 className="mb-1 flex items-center gap-2 text-base font-bold"><UserPlus className="h-5 w-5 text-indigo-500" /> Tạo tài khoản nhân viên</h3>
              <p className="mb-5 text-xs text-slate-500">Mật khẩu tối thiểu 12 ký tự. Tài khoản mới không được tự đăng ký.</p>
              {userFormError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{userFormError}</div>}
              <label className="mb-1 block text-xs font-semibold">Họ và tên</label>
              <input required minLength={2} maxLength={120} value={userForm.fullName} onChange={e => setUserForm(prev => ({ ...prev, fullName: e.target.value }))} className={`mb-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-50'}`} placeholder="Nguyễn Văn A" />
              <label className="mb-1 block text-xs font-semibold">Email</label>
              <input required type="email" maxLength={254} autoComplete="off" value={userForm.email} onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))} className={`mb-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-50'}`} placeholder="nhanvien@p2pmarketing.com.vn" />
              <label className="mb-1 block text-xs font-semibold">Mật khẩu tạm thời</label>
              <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={userForm.password} onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))} className={`mb-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-50'}`} placeholder="Tối thiểu 12 ký tự" />
              <label className="mb-1 block text-xs font-semibold">Vai trò</label>
              <select value={userForm.role} onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))} className={`mb-5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-50'}`}>
                <option value="production">Production — xem kho</option>
                <option value="warehouse">Thủ kho — nhập/xuất kho</option>
                <option value="manager">Quản lý — nhập/xuất, sửa phiếu</option>
              </select>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500"><UserPlus className="h-4 w-4" /> Tạo tài khoản</button>
            </form>

            <div className={`rounded-2xl border p-5 sm:p-6 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'} shadow-sm`}>
              <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold">Tài khoản hệ thống</h3><p className="mt-1 text-xs text-slate-500">Khóa tài khoản sẽ vô hiệu hóa token đang hoạt động.</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{usersList.length} tài khoản</span></div>
              {usersLoading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách...</p> : usersList.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Chưa có tài khoản nào.</p> : (
                <div className="space-y-3">
                  {usersList.map(user => <div key={user._id || user.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{user.fullName}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{user.active ? 'Hoạt động' : 'Đã khóa'}</span></div><p className="mt-1 break-all text-xs text-slate-500">{user.email}</p><p className="mt-1 text-[11px] text-indigo-500">{roleLabels[user.role] || user.role}</p></div>
                    <div className="flex shrink-0 items-center gap-2"><select aria-label={`Vai trò của ${user.fullName}`} disabled={String(user._id || user.id) === String(currentUser.id)} value={user.role} onChange={async e => { try { await updateUser(user._id || user.id, { role: e.target.value }); setUsersList(await fetchUsers()); showNotification('Đã cập nhật vai trò.', 'success'); } catch (err) { showNotification(err.response?.data?.error || 'Không thể cập nhật vai trò.', 'error'); } }} className={`rounded-lg border px-2 py-2 text-xs ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'}`}><option value="admin">Admin</option><option value="manager">Quản lý</option><option value="warehouse">Thủ kho</option><option value="production">Production</option></select><button type="button" disabled={String(user._id || user.id) === String(currentUser.id)} onClick={() => handleToggleUser(user)} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${user.active ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>{user.active ? 'Khóa' : 'Mở khóa'}</button></div>
                  </div>)}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {notification && (
        <div className="fixed top-5 right-5 z-[100] w-[min(92vw,390px)] animate-in slide-in-from-top-2">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
            notification.type === 'error'
              ? 'border-rose-200 bg-white text-slate-800'
              : 'border-emerald-200 bg-white text-slate-800'
          }`}>
            <div className={`mt-0.5 rounded-full p-1.5 ${
              notification.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {notification.type === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{notification.type === 'error' ? 'Có vấn đề xảy ra' : 'Thao tác thành công'}</p>
              <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{notification.message}</p>
            </div>
            <button type="button" onClick={() => setNotification(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng thông báo">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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