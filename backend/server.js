// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Ticket = require('./models/Ticket');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Kết nối MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Đã kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- API ROUTES ---

// 1. Lấy toàn bộ danh sách phiếu kho
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Tạo đơn Nhập kho mới
app.post('/api/tickets/inbound', async (req, res) => {
  try {
    const count = await Ticket.countDocuments();
    const ticketCode = `IN-${2026001 + count}`;
    
    const newTicket = new Ticket({
      ticketCode,
      sku: req.body.sku || 'N/A',
      itemName: req.body.itemName,
      unit: req.body.unit || 'Cái',
      status: 'Đang lưu kho',
      inbound: {
        sku: req.body.sku,
        quantity: Number(req.body.quantity),
        condition: req.body.condition || 'Mới 100%',
        deliveryUnit: req.body.deliveryUnit,
        department: req.body.department || 'Marketing',
        project: req.body.project || 'Sự kiện P2P',
        keeper: req.body.keeper || 'Kiên Đặng',
        zone: req.body.zone || 'Khu A',
        storageDays: Number(req.body.storageDays) || 30,
        note: req.body.note,
        photoUrl: req.body.photoUrl
      }
    });

    await newTicket.save();
    res.status(201).json(newTicket);
  } catch (err) {
    console.error("Lỗi khi tạo phiếu nhập:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// 3. Thực hiện Xuất kho
app.post('/api/tickets/:id/outbound', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Không tìm thấy phiếu kho!' });

    const exportQty = Number(req.body.quantity);
    const currentExported = ticket.totalExportedQuantity || 0;
    const remaining = ticket.inbound.quantity - currentExported;

    if (exportQty > remaining) {
      return res.status(400).json({ error: `Số lượng xuất vượt quá tồn kho hiện tại (${remaining})!` });
    }

    ticket.exportLogs.push({
      quantity: exportQty,
      condition: req.body.condition || 'Tốt',
      receiverDepartment: req.body.receiverDepartment || 'Vận hành',
      receiverName: req.body.receiverName,
      executor: req.body.executor || 'Kiên',
      transportUnit: req.body.transportUnit,
      note: req.body.note,
      photoUrl: req.body.photoUrl
    });

    ticket.totalExportedQuantity = currentExported + exportQty;
    ticket.status = ticket.totalExportedQuantity >= ticket.inbound.quantity ? 'Đã xuất hết' : 'Đã xuất kho một phần';

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Chỉnh sửa thông tin đơn hàng / đợt xuất
app.put('/api/tickets/:id', async (req, res) => {
  try {
    const { exportLogIndex, outboundUpdate, ...updateData } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Không tìm thấy đơn hàng!' });

    if (exportLogIndex !== undefined && exportLogIndex !== null) {
      if (ticket.exportLogs[exportLogIndex]) {
        ticket.exportLogs[exportLogIndex] = { ...ticket.exportLogs[exportLogIndex], ...outboundUpdate };
        const totalExp = ticket.exportLogs.reduce((sum, log) => sum + log.quantity, 0);
        ticket.totalExportedQuantity = totalExp;
        ticket.status = totalExp >= ticket.inbound.quantity ? 'Đã xuất hết' : 'Đã xuất kho một phần';
      }
    } else {
      if (updateData.itemName) ticket.itemName = updateData.itemName;
      if (updateData.sku) ticket.sku = updateData.sku;
      if (updateData.inbound) {
        ticket.inbound = { ...ticket.inbound, ...updateData.inbound };
      }
    }

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Xóa vĩnh viễn đơn hàng
app.delete('/api/tickets/:id', async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa đơn hàng thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend server đang chạy tại cổng ${PORT}`));