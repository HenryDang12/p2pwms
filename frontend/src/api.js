
import axios from 'axios';

const API_URL = 'https://p2pwms-1.onrender.com/api/tickets';

// 1. Lấy danh sách phiếu kho
export const fetchTickets = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

// 2. Tạo phiếu nhập kho
export const createInboundTicket = async (data) => {
  const response = await axios.post(`${API_URL}/inbound`, data);
  return response.data;
};

// 3. Xuất kho
export const submitOutboundTicket = async (id, data) => {
  const response = await axios.post(
    `${API_URL}/${id}/outbound`,
    data
  );
  return response.data;
};

// 4. Chỉnh sửa phiếu kho
export const updateTicket = async (id, data) => {
  const response = await axios.put(`${API_URL}/${id}`, data);
  return response.data;
};

// 5. Xóa phiếu kho
export const deleteTicket = async (id) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};
