const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Ticket = require('./models/Ticket');
const Job = require('./models/Job');
const Asset = require('./models/Asset');
const AuditLog = require('./models/AuditLog');
const Stocktake = require('./models/Stocktake');
const User = require('./models/User');
const Warehouse = require('./models/Warehouse');
const Notification = require('./models/Notification');
const authRoutes = require('./routes/auth.routes');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://p2pwms.vercel.app',
  ...(process.env.FRONTEND_URLS || '').split(',').map(value => value.trim()).filter(Boolean)
]);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin không được phép truy cập API.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Setup-Key'],
  maxAge: 86400
}));
app.use(express.json({ limit: '10mb' }));

function writeAudit(req, action, resourceType, resourceId, details = {}) {
  return AuditLog.create({
    actor: req.user?._id || null,
    actorEmail: req.user?.email || '',
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : '',
    details,
    ip: req.ip || '',
    userAgent: String(req.get('user-agent') || '').slice(0, 300)
  }).catch(err => console.error('Không ghi được audit log:', err.message));
}

async function createNotification({ recipientIds = [], type, title, message, metadata = {} }) {
  const uniqueIds = [...new Set(recipientIds.filter(Boolean).map(String))];
  if (!uniqueIds.length) return null;
  return Notification.create({
    recipients: uniqueIds.map(userId => ({ userId, isRead: false, readAt: null })),
    type,
    title,
    message,
    metadata
  }).catch(err => console.error('Không gửi được thông báo:', err.message));
}

function hasWarehouseAction(user, warehouse, action) {
  if (!user || !warehouse) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'cs' && String(warehouse.createdBy) === String(user._id)) return true;
  const perms = Array.isArray(user.warehousePermissions) ? user.warehousePermissions : [];
  const matched = perms.find(item => String(item.warehouseId) === String(warehouse._id));
  return Boolean(matched && Array.isArray(matched.actions) && matched.actions.includes(action));
}

async function resolveWarehouseForAction(req, action) {
  const rawWarehouseId = req.body?.warehouseId || req.query?.warehouseId || null;
  if (!rawWarehouseId) {
    if (req.user?.role === 'admin') return { warehouse: null };
    return { error: 'Vui lòng chọn bãi kho (warehouseId) trước khi thao tác.', status: 400 };
  }
  if (!mongoose.isValidObjectId(rawWarehouseId)) {
    return { error: 'ID bãi kho không hợp lệ.', status: 400 };
  }
  const warehouse = await Warehouse.findById(rawWarehouseId);
  if (!warehouse) {
    return { error: 'Không tìm thấy bãi kho.', status: 404 };
  }
  if (warehouse.approvalStatus !== 'approved') {
    return { error: 'Bãi kho chưa được Admin duyệt hoạt động.', status: 403 };
  }
  if (!hasWarehouseAction(req.user, warehouse, action)) {
    return { error: `Bạn chưa được CS cấp quyền ${action} tại bãi kho "${warehouse.name}".`, status: 403 };
  }
  return { warehouse };
}

app.get('/', (req, res) => {
  res.send('P2P WMS API is running. Authentication is required for warehouse endpoints.');
});

app.get('/health', (req, res) => {
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'database_unavailable',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth', authRoutes);

// ==========================================
// QUẢN LÝ BÃI KHO & PHÂN QUYỀN FOP / TRỰC KHO
// ==========================================
app.get('/api/warehouses', authenticate, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'cs') {
      filter = { createdBy: req.user._id };
    } else if (['fop', 'warehouse_keeper'].includes(req.user.role)) {
      const allowedIds = (req.user.warehousePermissions || []).map(p => p.warehouseId);
      filter = { _id: { $in: allowedIds }, approvalStatus: 'approved' };
    }
    const list = await Warehouse.find(filter)
      .populate('createdBy', 'fullName email role')
      .populate('approvedBy', 'fullName email role')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(list);
  } catch (err) {
    console.error('GET /api/warehouses:', err.message);
    return res.status(500).json({ error: 'Không thể tải danh sách bãi kho.' });
  }
});

// CS đăng ký / tạo bãi kho mới -> gửi Admin duyệt
app.post('/api/warehouses', authenticate, authorize('admin', 'cs'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const address = String(req.body.rentalInfo?.address || req.body.address || '').trim();
    if (name.length < 2 || name.length > 200) {
      return res.status(400).json({ error: 'Tên bãi kho phải từ 2-200 ký tự.' });
    }
    if (!address) {
      return res.status(400).json({ error: 'Địa chỉ bãi kho là bắt buộc.' });
    }

    const isAdmin = req.user.role === 'admin';
    const warehouse = await Warehouse.create({
      name,
      code: String(req.body.code || '').trim().toUpperCase().slice(0, 60),
      rentalInfo: {
        providerName: String(req.body.rentalInfo?.providerName || req.body.providerName || '').trim().slice(0, 200),
        address: address.slice(0, 300),
        areaSqm: Number(req.body.rentalInfo?.areaSqm || req.body.areaSqm || 0) || 0,
        startDate: req.body.rentalInfo?.startDate || null,
        endDate: req.body.rentalInfo?.endDate || null,
        contractNote: String(req.body.rentalInfo?.contractNote || req.body.contractNote || '').trim().slice(0, 2000)
      },
      approvalStatus: isAdmin ? 'approved' : 'pending',
      createdBy: req.user._id,
      approvedBy: isAdmin ? req.user._id : null,
      approvedAt: isAdmin ? new Date() : null
    });

    if (!isAdmin) {
      const admins = await User.find({ role: 'admin', active: true }).select('_id').lean();
      await createNotification({
        recipientIds: admins.map(a => a._id),
        type: 'WAREHOUSE_PENDING',
        title: `Chờ duyệt bãi kho "${warehouse.name}"`,
        message: `CS ${req.user.fullName} (${req.user.email}) đã đăng ký bãi kho "${warehouse.name}" chờ Admin duyệt.`,
        metadata: {
          warehouseId: warehouse._id,
          actorId: req.user._id,
          actorName: req.user.fullName,
          actorRole: req.user.role
        }
      });
    }

    await writeAudit(req, 'warehouse.created', 'warehouse', warehouse._id, { name: warehouse.name, approvalStatus: warehouse.approvalStatus });
    return res.status(201).json(warehouse);
  } catch (err) {
    console.error('POST /api/warehouses:', err.message);
    return res.status(400).json({ error: 'Không thể tạo bãi kho.' });
  }
});

// Admin duyệt hoặc từ chối bãi kho
app.patch('/api/warehouses/:id/approval', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID bãi kho không hợp lệ.' });
    }
    const approvalStatus = req.body.approvalStatus;
    if (!['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ error: 'Trạng thái duyệt không hợp lệ.' });
    }
    const rejectReason = approvalStatus === 'rejected' ? String(req.body.rejectReason || '').trim().slice(0, 1000) : '';

    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus,
        approvedBy: req.user._id,
        approvedAt: new Date(),
        rejectReason
      },
      { new: true }
    );
    if (!warehouse) return res.status(404).json({ error: 'Không tìm thấy bãi kho.' });

    await createNotification({
      recipientIds: [warehouse.createdBy],
      type: approvalStatus === 'approved' ? 'WAREHOUSE_APPROVED' : 'WAREHOUSE_REJECTED',
      title: approvalStatus === 'approved' ? `Bãi kho "${warehouse.name}" đã được duyệt` : `Bãi kho "${warehouse.name}" bị từ chối`,
      message: approvalStatus === 'approved'
        ? `Admin ${req.user.fullName} đã duyệt bãi kho "${warehouse.name}". Bạn có thể cấp quyền cho FOP và người trực kho.`
        : `Bãi kho "${warehouse.name}" bị từ chối. Lý do: ${rejectReason || 'Không có lý do'}.`,
      metadata: {
        warehouseId: warehouse._id,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role
      }
    });

    await writeAudit(req, 'warehouse.approval', 'warehouse', warehouse._id, { approvalStatus, rejectReason });
    return res.json(warehouse);
  } catch (err) {
    console.error('PATCH /api/warehouses/:id/approval:', err.message);
    return res.status(400).json({ error: 'Không thể cập nhật trạng thái duyệt bãi kho.' });
  }
});

// CS lấy danh sách FOP và người trực kho để cấp quyền
app.get('/api/warehouse-staff', authenticate, authorize('admin', 'cs'), async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['fop', 'warehouse_keeper'] }, active: true })
      .select('fullName email role warehousePermissions')
      .populate('warehousePermissions.warehouseId', 'name approvalStatus')
      .lean();
    return res.json(users);
  } catch (err) {
    console.error('GET /api/warehouse-staff:', err.message);
    return res.status(500).json({ error: 'Không thể tải danh sách nhân sự bãi kho.' });
  }
});

// CS cấp quyền (import / export / pick) trên bãi kho cho FOP hoặc người trực kho
app.post('/api/warehouses/:id/permissions', authenticate, authorize('admin', 'cs'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.body.targetUserId)) {
      return res.status(400).json({ error: 'ID bãi kho hoặc tài khoản không hợp lệ.' });
    }
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ error: 'Không tìm thấy bãi kho.' });
    if (warehouse.approvalStatus !== 'approved') {
      return res.status(400).json({ error: 'Chỉ cấp quyền được trên bãi kho đã được Admin duyệt.' });
    }
    if (req.user.role === 'cs' && String(warehouse.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Bạn chỉ được cấp quyền trên bãi kho do mình quản lý.' });
    }

    const targetUser = await User.findById(req.body.targetUserId);
    if (!targetUser || !['fop', 'warehouse_keeper'].includes(targetUser.role)) {
      return res.status(400).json({ error: 'Tài khoản nhận quyền phải là FOP hoặc người trực kho.' });
    }

    const allowedActions = ['import', 'export', 'pick'];
    const actions = [...new Set((Array.isArray(req.body.actions) ? req.body.actions : []).filter(a => allowedActions.includes(a)))];

    const idx = targetUser.warehousePermissions.findIndex(p => String(p.warehouseId) === String(warehouse._id));
    if (idx > -1) {
      if (!actions.length) {
        targetUser.warehousePermissions.splice(idx, 1);
      } else {
        targetUser.warehousePermissions[idx].actions = actions;
        targetUser.warehousePermissions[idx].grantedBy = req.user._id;
        targetUser.warehousePermissions[idx].grantedAt = new Date();
      }
    } else if (actions.length) {
      targetUser.warehousePermissions.push({
        warehouseId: warehouse._id,
        actions,
        grantedBy: req.user._id,
        grantedAt: new Date()
      });
    }

    await targetUser.save();
    await writeAudit(req, 'warehouse.permission_updated', 'user', targetUser._id, {
      warehouseId: warehouse._id,
      warehouseName: warehouse.name,
      actions
    });
    return res.json({ message: 'Đã cập nhật phân quyền bãi kho.', warehousePermissions: targetUser.warehousePermissions });
  } catch (err) {
    console.error('POST /api/warehouses/:id/permissions:', err.message);
    return res.status(400).json({ error: 'Không thể lưu phân quyền bãi kho.' });
  }
});

// ==========================================
// THÔNG BÁO CHO CS QUẢN LÝ BÃI & ADMIN
// ==========================================
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const raw = await Notification.find({ 'recipients.userId': req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const notifications = raw.map(doc => {
      const me = (doc.recipients || []).find(r => String(r.userId) === String(req.user._id));
      return {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        isRead: Boolean(me?.isRead),
        readAt: me?.readAt || null
      };
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return res.json({ unreadCount, notifications });
  } catch (err) {
    console.error('GET /api/notifications:', err.message);
    return res.status(500).json({ error: 'Không thể tải thông báo.' });
  }
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID thông báo không hợp lệ.' });
    }
    await Notification.updateOne(
      { _id: req.params.id, 'recipients.userId': req.user._id },
      { $set: { 'recipients.$.isRead': true, 'recipients.$.readAt': new Date() } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/notifications/:id/read:', err.message);
    return res.status(400).json({ error: 'Không thể đánh dấu đã đọc.' });
  }
});

// ==========================================
// PHIẾU KHO: NHẬP / XUẤT / LẤY HÀNG
// ==========================================
app.use('/api/tickets', authenticate);

app.get('/api/tickets', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB chưa kết nối. Vui lòng thử lại.' });
    }
    const tickets = await Ticket.find({}).sort({ createdAt: -1 }).lean().exec();
    return res.status(200).json(tickets);
  } catch (err) {
    console.error('GET /api/tickets:', err.message);
    return res.status(500).json({ error: 'Không thể tải danh sách phiếu kho.' });
  }
});

app.post('/api/tickets/inbound', authorize('admin', 'cs', 'fop', 'warehouse_keeper'), async (req, res) => {
  try {
    const whCheck = await resolveWarehouseForAction(req, 'import');
    if (whCheck.error) return res.status(whCheck.status).json({ error: whCheck.error });

    const quantity = Number(req.body.quantity);
    const sku = String(req.body.sku || '').trim().toUpperCase();
    const itemName = String(req.body.itemName || '').trim();
    if (!sku || sku.length > 80) return res.status(400).json({ error: 'SKU là bắt buộc và tối đa 80 ký tự.' });
    if (!itemName || itemName.length > 200) return res.status(400).json({ error: 'Tên hàng hóa là bắt buộc và tối đa 200 ký tự.' });
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000) {
      return res.status(400).json({ error: 'Số lượng nhập phải lớn hơn 0 và hợp lệ.' });
    }

    const count = await Ticket.countDocuments();
    const ticketCode = `IN-${2026001 + count}`;
    const newTicket = new Ticket({
      ticketCode,
      warehouseId: whCheck.warehouse?._id || null,
      sku,
      itemName,
      unit: String(req.body.unit || 'Cái').slice(0, 40),
      status: 'Đang lưu kho',
      inbound: {
        sku,
        quantity,
        condition: String(req.body.condition || 'Mới 100%').slice(0, 100),
        deliveryUnit: String(req.body.deliveryUnit || '').slice(0, 200),
        department: String(req.body.department || 'Marketing').slice(0, 120),
        project: String(req.body.project || 'Sự kiện P2P').slice(0, 200),
        keeper: String(req.body.keeper || req.user.fullName).slice(0, 120),
        zone: String(req.body.zone || 'Khu A').slice(0, 120),
        storageDays: Math.max(0, Number(req.body.storageDays) || 30),
        note: String(req.body.note || '').slice(0, 2000),
        photoUrl: typeof req.body.photoUrl === 'string' ? req.body.photoUrl : undefined
      }
    });

    await newTicket.save();
    await writeAudit(req, 'ticket.inbound_created', 'ticket', newTicket._id, {
      ticketCode,
      sku,
      quantity,
      warehouseId: whCheck.warehouse?._id || null
    });

    if (whCheck.warehouse) {
      const admins = await User.find({ role: 'admin', active: true }).select('_id').lean();
      await createNotification({
        recipientIds: [whCheck.warehouse.createdBy, ...admins.map(a => a._id)],
        type: 'STOCK_ACTION',
        title: `[NHẬP HÀNG] ${whCheck.warehouse.name} - ${ticketCode}`,
        message: `${req.user.fullName} (${req.user.role}) đã nhập ${quantity} ${newTicket.unit} [${sku} - ${itemName}] tại bãi "${whCheck.warehouse.name}".`,
        metadata: {
          warehouseId: whCheck.warehouse._id,
          transactionId: newTicket._id,
          actionType: 'import',
          actorId: req.user._id,
          actorName: req.user.fullName,
          actorRole: req.user.role
        }
      });
    }

    res.status(201).json(newTicket);
  } catch (err) {
    console.error('Tạo phiếu nhập:', err.message);
    res.status(400).json({ error: err.code === 11000 ? 'Mã phiếu bị trùng. Vui lòng thử lại.' : 'Không thể tạo phiếu nhập.' });
  }
});

app.post('/api/tickets/:id/outbound', authorize('admin', 'cs', 'fop', 'warehouse_keeper'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID phiếu kho không hợp lệ.' });
    const exportQty = Number(req.body.quantity);
    const receiverName = String(req.body.receiverName || '').trim();
    if (receiverName.length < 2) return res.status(400).json({ error: 'Cần ghi rõ người nhận hàng để xác nhận bàn giao.' });
    if (req.body.receiverConfirmed !== true) return res.status(400).json({ error: 'Người nhận phải xác nhận đã nhận bàn giao.' });
    if (!Number.isFinite(exportQty) || exportQty <= 0) return res.status(400).json({ error: 'Số lượng xuất phải lớn hơn 0.' });

    const existingTicket = await Ticket.findById(req.params.id).lean();
    if (!existingTicket) return res.status(404).json({ error: 'Không tìm thấy phiếu kho.' });

    const effectiveWarehouseId = req.body.warehouseId || existingTicket.warehouseId || null;
    if (effectiveWarehouseId) {
      req.body.warehouseId = effectiveWarehouseId;
    }
    const actionName = req.body.actionMode === 'pick' ? 'pick' : 'export';
    const whCheck = await resolveWarehouseForAction(req, actionName);
    if (whCheck.error) return res.status(whCheck.status).json({ error: whCheck.error });

    const jobId = req.body.jobId || null;
    let job = null;
    if (jobId) {
      if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ error: 'Job/Event không hợp lệ.' });
      job = await Job.findById(jobId);
      if (!job || ['completed', 'cancelled'].includes(job.status)) return res.status(400).json({ error: 'Job/Event không tồn tại hoặc đã đóng.' });
    }
    const assetIds = Array.isArray(req.body.assetIds) ? [...new Set(req.body.assetIds.map(String))] : [];
    if (assetIds.length) {
      if (assetIds.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ error: 'Có mã thiết bị không hợp lệ.' });
      const assets = await Asset.find({ _id: { $in: assetIds }, sku: String(req.body.sku || '').trim().toUpperCase(), status: 'available' });
      if (assets.length !== assetIds.length) return res.status(409).json({ error: 'Một hoặc nhiều thiết bị không còn khả dụng hoặc không khớp SKU. Tải lại dữ liệu.' });
      if (Number(req.body.quantity) !== assetIds.length) return res.status(400).json({ error: 'Với thiết bị quản lý theo mã riêng, số lượng xuất phải bằng số thiết bị chọn.' });
    }

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ['$totalExportedQuantity', 0] }, exportQty] },
            '$inbound.quantity'
          ]
        }
      },
      {
        $set: { warehouseId: whCheck.warehouse?._id || existingTicket.warehouseId || null },
        $inc: { totalExportedQuantity: exportQty },
        $push: {
          exportLogs: {
            quantity: exportQty,
            condition: String(req.body.condition || 'Tốt').slice(0, 100),
            receiverDepartment: String(req.body.receiverDepartment || 'Vận hành').slice(0, 120),
            receiverName: receiverName.slice(0, 120),
            receiverConfirmed: true,
            receiverConfirmedAt: new Date(),
            executor: req.user.fullName,
            performedBy: req.user._id,
            performedByRole: req.user.role,
            transportUnit: String(req.body.transportUnit || '').slice(0, 120),
            note: String(req.body.note || '').slice(0, 2000),
            photoUrl: typeof req.body.photoUrl === 'string' ? req.body.photoUrl : undefined,
            jobId: job?._id || null,
            jobCode: job?.jobCode || String(req.body.jobCode || '').slice(0, 80),
            jobName: job?.name || String(req.body.jobName || '').slice(0, 200),
            assetIds
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      const exists = await Ticket.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'Không tìm thấy phiếu kho.' });
      const current = await Ticket.findById(req.params.id).select('inbound.quantity totalExportedQuantity').lean();
      const remaining = Math.max(0, Number(current?.inbound?.quantity || 0) - Number(current?.totalExportedQuantity || 0));
      return res.status(409).json({ error: `Số lượng xuất vượt tồn khả dụng (${remaining}). Tải lại dữ liệu và thử lại.` });
    }

    if (assetIds.length) {
      const assigned = await Asset.updateMany({ _id: { $in: assetIds }, status: 'available' }, { $set: { status: 'assigned', currentJob: job?._id || null, sourceTicket: ticket._id } });
      if (assigned.modifiedCount !== assetIds.length) return res.status(409).json({ error: 'Không thể gán một số thiết bị do trạng thái vừa thay đổi. Kiểm tra lại tồn kho.' });
    }
    if (job && job.status === 'planning') { job.status = 'active'; await job.save(); }
    ticket.status = Number(ticket.totalExportedQuantity || 0) >= Number(ticket.inbound?.quantity || 0)
      ? 'Đã xuất hết'
      : 'Đã xuất kho một phần';
    await ticket.save();
    await writeAudit(req, 'ticket.outbound_created', 'ticket', ticket._id, {
      ticketCode: ticket.ticketCode,
      quantity: exportQty,
      warehouseId: ticket.warehouseId || null
    });

    if (whCheck.warehouse) {
      const admins = await User.find({ role: 'admin', active: true }).select('_id').lean();
      const label = actionName === 'pick' ? 'LẤY HÀNG' : 'XUẤT HÀNG';
      await createNotification({
        recipientIds: [whCheck.warehouse.createdBy, ...admins.map(a => a._id)],
        type: 'STOCK_ACTION',
        title: `[${label}] ${whCheck.warehouse.name} - ${ticket.ticketCode}`,
        message: `${req.user.fullName} (${req.user.role}) đã ${label.toLowerCase()} ${exportQty} ${ticket.unit} [${ticket.sku} - ${ticket.itemName}] tại bãi "${whCheck.warehouse.name}".`,
        metadata: {
          warehouseId: whCheck.warehouse._id,
          transactionId: ticket._id,
          actionType: actionName,
          actorId: req.user._id,
          actorName: req.user.fullName,
          actorRole: req.user.role
        }
      });
    }

    res.json(ticket);
  } catch (err) {
    console.error('Xuất kho:', err.message);
    res.status(400).json({ error: 'Không thể xác nhận xuất kho.' });
  }
});

app.put('/api/tickets/:id', authorize('admin', 'cs'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID phiếu kho không hợp lệ.' });
    const { exportLogIndex, outboundUpdate, ...updateData } = req.body || {};
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Không tìm thấy phiếu kho.' });

    if (exportLogIndex !== undefined && exportLogIndex !== null) {
      const index = Number(exportLogIndex);
      if (!Number.isInteger(index) || index < 0 || !ticket.exportLogs[index]) {
        return res.status(400).json({ error: 'Đợt xuất kho không hợp lệ.' });
      }
      const allowed = ['condition', 'receiverDepartment', 'receiverName', 'transportUnit', 'note', 'photoUrl'];
      for (const key of allowed) {
        if (outboundUpdate && Object.prototype.hasOwnProperty.call(outboundUpdate, key)) {
          ticket.exportLogs[index][key] = outboundUpdate[key];
        }
      }
    } else {
      if (typeof updateData.itemName === 'string' && updateData.itemName.trim()) ticket.itemName = updateData.itemName.trim().slice(0, 200);
      if (typeof updateData.sku === 'string' && updateData.sku.trim()) ticket.sku = updateData.sku.trim().toUpperCase().slice(0, 80);
      if (updateData.inbound && typeof updateData.inbound === 'object') {
        const allowedInbound = ['condition', 'deliveryUnit', 'department', 'project', 'keeper', 'zone', 'storageDays', 'note', 'photoUrl'];
        for (const key of allowedInbound) {
          if (Object.prototype.hasOwnProperty.call(updateData.inbound, key)) ticket.inbound[key] = updateData.inbound[key];
        }
      }
    }

    await ticket.save();
    await writeAudit(req, 'ticket.updated', 'ticket', ticket._id, { ticketCode: ticket.ticketCode });
    res.json(ticket);
  } catch (err) {
    console.error('Sửa phiếu kho:', err.message);
    res.status(400).json({ error: 'Không thể cập nhật phiếu kho.' });
  }
});

app.delete('/api/tickets/:id', authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID phiếu kho không hợp lệ.' });
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Không tìm thấy phiếu kho.' });
    await writeAudit(req, 'ticket.deleted', 'ticket', ticket._id, { ticketCode: ticket.ticketCode, sku: ticket.sku, itemName: ticket.itemName });
    await Ticket.deleteOne({ _id: ticket._id });
    res.json({ message: 'Đã xóa phiếu kho.' });
  } catch (err) {
    console.error('Xóa phiếu kho:', err.message);
    res.status(500).json({ error: 'Không thể xóa phiếu kho.' });
  }
});

// Job/Event: mọi tài khoản đăng nhập xem được; tạo/sửa chỉ Admin, CS, FOP.
app.get('/api/jobs', authenticate, async (req, res) => {
  try { const jobs = await Job.find({}).sort({ startDate: -1, createdAt: -1 }).lean(); res.json(jobs); }
  catch (err) { res.status(500).json({ error: 'Không thể tải danh sách Job/Event.' }); }
});
app.post('/api/jobs', authenticate, authorize('admin', 'cs', 'fop'), async (req, res) => {
  try {
    const jobCode = String(req.body.jobCode || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(jobCode)) return res.status(400).json({ error: 'Mã Job phải 3-40 ký tự, gồm chữ, số, gạch ngang hoặc gạch dưới.' });
    if (name.length < 2 || name.length > 200) return res.status(400).json({ error: 'Tên Job phải từ 2-200 ký tự.' });
    const job = await Job.create({ jobCode, name, client: String(req.body.client || '').slice(0,160), eventLocation: String(req.body.eventLocation || '').slice(0,250), startDate: req.body.startDate || undefined, endDate: req.body.endDate || undefined, owner: String(req.body.owner || req.user.fullName).slice(0,120), notes: String(req.body.notes || '').slice(0,2000), status: 'planning', createdBy: req.user._id });
    await writeAudit(req, 'job.created', 'job', job._id, { jobCode, name }); res.status(201).json(job);
  } catch (err) { res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? 'Mã Job đã tồn tại.' : 'Không thể tạo Job/Event.' }); }
});
app.patch('/api/jobs/:id', authenticate, authorize('admin', 'cs'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID Job không hợp lệ.' });
    const job = await Job.findById(req.params.id); if (!job) return res.status(404).json({ error: 'Không tìm thấy Job.' });
    if (['planning','active','completed','cancelled'].includes(req.body.status)) job.status = req.body.status;
    for (const key of ['client','eventLocation','owner','notes']) if (typeof req.body[key] === 'string') job[key] = req.body[key].slice(0, key === 'notes' ? 2000 : 250);
    if (typeof req.body.name === 'string' && req.body.name.trim()) job.name = req.body.name.trim().slice(0,200);
    if (req.body.startDate !== undefined) job.startDate = req.body.startDate || null;
    if (req.body.endDate !== undefined) job.endDate = req.body.endDate || null;
    await job.save(); await writeAudit(req, 'job.updated', 'job', job._id, { status: job.status }); res.json(job);
  } catch (err) { res.status(400).json({ error: 'Không thể cập nhật Job/Event.' }); }
});

// Thiết bị tái sử dụng được theo dõi từng mã tài sản/serial.
app.get('/api/assets', authenticate, async (req, res) => {
  try { const assets = await Asset.find({}).populate('currentJob', 'jobCode name status').populate('returnLogs.executorId', 'fullName email').sort({ createdAt: -1 }).lean(); res.json(assets); }
  catch (err) { res.status(500).json({ error: 'Không thể tải danh sách thiết bị.' }); }
});
app.post('/api/assets', authenticate, authorize('admin', 'cs', 'fop', 'warehouse_keeper'), async (req, res) => {
  try {
    const assetCode = String(req.body.assetCode || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim(); const sku = String(req.body.sku || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{2,59}$/.test(assetCode)) return res.status(400).json({ error: 'Mã tài sản phải 3-60 ký tự.' });
    if (name.length < 2 || !sku) return res.status(400).json({ error: 'Tên thiết bị và SKU là bắt buộc.' });
    const asset = await Asset.create({ assetCode, name, sku, serialNumber: String(req.body.serialNumber || '').slice(0,160), category: String(req.body.category || 'Thiết bị').slice(0,100), location: String(req.body.location || 'Kho P2P').slice(0,160), condition: ['Tốt','Cần kiểm tra','Hư hỏng'].includes(req.body.condition) ? req.body.condition : 'Tốt', notes: String(req.body.notes || '').slice(0,2000), createdBy: req.user._id });
    await writeAudit(req, 'asset.created', 'asset', asset._id, { assetCode, sku }); res.status(201).json(asset);
  } catch (err) { res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? 'Mã tài sản đã tồn tại.' : 'Không thể tạo thiết bị.' }); }
});
app.post('/api/assets/:id/return', authenticate, authorize('admin', 'cs', 'fop', 'warehouse_keeper'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID thiết bị không hợp lệ.' });
    const condition = ['Tốt','Cần kiểm tra','Hư hỏng'].includes(req.body.condition) ? req.body.condition : 'Tốt';
    const receivedBy = String(req.body.receivedBy || '').trim();
    if (receivedBy.length < 2) return res.status(400).json({ error: 'Cần ghi rõ người nhận lại thiết bị tại kho.' });
    const returnedBy = String(req.body.returnedBy || '').trim();
    const note = String(req.body.note || '').slice(0, 2000);
    const photoUrl = typeof req.body.photoUrl === 'string' ? req.body.photoUrl : '';
    const existing = await Asset.findOne({ _id: req.params.id, status: 'assigned' }).populate('currentJob', 'jobCode');
    if (!existing) return res.status(409).json({ error: 'Thiết bị không ở trạng thái đang xuất/đang gán Job.' });
    const returnJobCode = existing.currentJob?.jobCode || '';
    existing.status = condition === 'Hư hỏng' ? 'maintenance' : 'available';
    existing.condition = condition; existing.currentJob = null; existing.location = String(req.body.location || 'Kho P2P').slice(0,160);
    existing.returnLogs.push({ returnedBy, receivedBy, condition, note, photoUrl, jobCode: returnJobCode, executorId: req.user._id, timestamp: new Date() });
    const asset = existing;
    await asset.save();
    if (asset.sourceTicket) {
      const ticket = await Ticket.findById(asset.sourceTicket);
      if (ticket) { ticket.totalExportedQuantity = Math.max(0, Number(ticket.totalExportedQuantity || 0) - 1); ticket.status = ticket.totalExportedQuantity <= 0 ? 'Đang lưu kho' : (ticket.totalExportedQuantity >= ticket.inbound.quantity ? 'Đã xuất hết' : 'Đã xuất kho một phần'); await ticket.save(); }
      asset.sourceTicket = null; await asset.save();
    }
    await writeAudit(req, 'asset.returned', 'asset', asset._id, { condition });
    const responseAsset = await Asset.findById(asset._id)
      .populate('currentJob', 'jobCode name status')
      .populate('returnLogs.executorId', 'fullName email')
      .lean();
    res.json(responseAsset);
  } catch (err) { res.status(400).json({ error: 'Không thể hoàn kho thiết bị.' }); }
});

// Kiểm kê: lưu biên bản đối soát, không tự ý điều chỉnh tồn kho.
app.get('/api/stocktakes', authenticate, async (req, res) => {
  try { const rows = await Stocktake.find({}).sort({ createdAt: -1 }).limit(100).lean(); res.json(rows); }
  catch (err) { res.status(500).json({ error: 'Không thể tải lịch sử kiểm kê.' }); }
});
app.post('/api/stocktakes', authenticate, authorize('admin', 'cs', 'fop', 'warehouse_keeper'), async (req, res) => {
  try {
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!lines.length || lines.length > 2000) return res.status(400).json({ error: 'Biên bản cần có từ 1 đến 2.000 dòng kiểm kê.' });
    const normalized = lines.map((line) => {
      const sku = String(line.sku || '').trim().toUpperCase();
      const itemName = String(line.itemName || '').trim();
      const systemQuantity = Number(line.systemQuantity); const countedQuantity = Number(line.countedQuantity);
      if (!sku || !itemName || !Number.isFinite(systemQuantity) || systemQuantity < 0 || !Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error('Dữ liệu kiểm kê không hợp lệ.');
      return { sku, itemName: itemName.slice(0,200), systemQuantity, countedQuantity, difference: countedQuantity-systemQuantity, note: String(line.note || '').slice(0,1000) };
    });
    const count = await Stocktake.countDocuments();
    const stocktake = await Stocktake.create({ stocktakeCode: `KK-${new Date().getFullYear()}-${String(count+1).padStart(5,'0')}`, location: String(req.body.location || 'Toàn kho').slice(0,160), note: String(req.body.note || '').slice(0,2000), lines: normalized, totalLines: normalized.length, discrepancyLines: normalized.filter(x => x.difference !== 0).length, createdBy: req.user._id, createdByName: req.user.fullName });
    await writeAudit(req, 'stocktake.created', 'stocktake', stocktake._id, { stocktakeCode: stocktake.stocktakeCode, totalLines: stocktake.totalLines, discrepancyLines: stocktake.discrepancyLines });
    res.status(201).json(stocktake);
  } catch (err) { res.status(400).json({ error: err.message || 'Không thể lưu biên bản kiểm kê.' }); }
});

// Chỉ Admin/CS xem audit log toàn hệ thống.
app.get('/api/audit-logs', authenticate, authorize('admin', 'cs'), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải nhật ký hệ thống.' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.message === 'Origin không được phép truy cập API.') {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled API error:', err?.message || err);
  res.status(500).json({ error: 'Lỗi máy chủ không xác định.' });
});

const PORT = process.env.PORT || 5000;
async function start() {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI trong biến môi trường.');
  if (!process.env.AUTH_TOKEN_SECRET || Buffer.byteLength(process.env.AUTH_TOKEN_SECRET) < 32) {
    throw new Error('Thiếu AUTH_TOKEN_SECRET hoặc secret ngắn hơn 32 bytes.');
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`P2P WMS API running on port ${PORT}`));
}

start().catch(err => {
  console.error('Không thể khởi động P2P WMS:', err.message);
  process.exit(1);
});