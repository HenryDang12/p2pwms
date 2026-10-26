import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const fetchTickets = async () => {
  const response = await axios.get(`${API_URL}/tickets`);
  return response.data;
};

export const createInboundTicket = async (data) => {
  const response = await axios.post(`${API_URL}/tickets/inbound`, data);
  return response.data;
};

export const submitOutboundTicket = async (id, data) => {
  const response = await axios.post(`${API_URL}/tickets/${id}/outbound`, data);
  return response.data;
};

export const updateTicket = async (id, data) => {
  const response = await axios.put(`${API_URL}/tickets/${id}`, data);
  return response.data;
};

// 👉 Thêm hàm deleteTicket này vào file src/api.js của bạn
export const deleteTicket = async (id) => {
  const response = await axios.delete(`${API_URL}/tickets/${id}`);
  return response.data;
};