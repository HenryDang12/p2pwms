const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Ticket = require('./models/Ticket');
const AuditLog = require('./models/AuditLog');
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

// Tất cả API nghiệp vụ kho yêu cầu đăng nhập.
app.use('/api/tickets', authenticate);

// 1. Lấy toàn bộ phiếu kho (mọi tài khoản đăng nhập đều được đọc).
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

// 2. Tạo phiếu nhập: Admin, Quản lý, Thủ kho.
app.post('/api/tickets/inbound', authorize('admin', 'manager', 'warehouse'), async (req, res) => {
  try {
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
    await writeAudit(req, 'ticket.inbound_created', 'ticket', newTicket._id, { ticketCode, sku, quantity });
    res.status(201).json(newTicket);
  } catch (err) {
    console.error('Tạo phiếu nhập:', err.message);
    res.status(400).json({ error: err.code === 11000 ? 'Mã phiếu bị trùng. Vui lòng thử lại.' : 'Không thể tạo phiếu nhập.' });
  }
});

// 3. Xuất kho: chỉ Admin, Quản lý, Thủ kho được xác nhận giao dịch thực tế.
app.post('/api/tickets/:id/outbound', authorize('admin', 'manager', 'warehouse'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID phiếu kho không hợp lệ.' });
    const exportQty = Number(req.body.quantity);
    if (!Number.isFinite(exportQty) || exportQty <= 0) return res.status(400).json({ error: 'Số lượng xuất phải lớn hơn 0.' });

    // Atomic conditional update prevents concurrent requests from exporting more than the remaining quantity.
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
        $inc: { totalExportedQuantity: exportQty },
        $push: { exportLogs: {
          quantity: exportQty,
          condition: String(req.body.condition || 'Tốt').slice(0, 100),
          receiverDepartment: String(req.body.receiverDepartment || 'Vận hành').slice(0, 120),
          receiverName: String(req.body.receiverName || '').slice(0, 120),
          executor: req.user.fullName,
          transportUnit: String(req.body.transportUnit || '').slice(0, 120),
          note: String(req.body.note || '').slice(0, 2000),
          photoUrl: typeof req.body.photoUrl === 'string' ? req.body.photoUrl : undefined
        } }
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

    ticket.status = Number(ticket.totalExportedQuantity || 0) >= Number(ticket.inbound?.quantity || 0)
      ? 'Đã xuất hết'
      : 'Đã xuất kho một phần';
    await ticket.save();
    await writeAudit(req, 'ticket.outbound_created', 'ticket', ticket._id, { ticketCode: ticket.ticketCode, quantity: exportQty });
    res.json(ticket);
  } catch (err) {
    console.error('Xuất kho:', err.message);
    res.status(400).json({ error: 'Không thể xác nhận xuất kho.' });
  }
});

// 4. Chỉnh sửa: chỉ Admin/Quản lý. Không cho sửa các trường hệ thống tùy ý.
app.put('/api/tickets/:id', authorize('admin', 'manager'), async (req, res) => {
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
      // Quantities and executor cannot be changed through this endpoint because that would rewrite stock history.
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

// 5. Xóa phiếu: chỉ Admin. Xóa được ghi nhật ký audit.
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

// Chỉ Admin/Quản lý xem audit log toàn hệ thống.
app.get('/api/audit-logs', authenticate, authorize('admin', 'manager'), async (req, res) => {
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
