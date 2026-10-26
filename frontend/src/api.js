import axios from 'axios';

const API_URL = 'https://p2pwms-1.onrender.com/api/tickets';

export const fetchTickets = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const createInboundTicket = async (data) => {
  const response = await axios.post(`${API_URL}/inbound`, data);
  return response.data;
};

export const submitOutboundTicket = async (id, data) => {
  const response = await axios.post(`${API_URL}/${id}/outbound`, data);
  return response.data;
};

export const updateTicket = async (id, data) => {
  const response = await axios.put(`${API_URL}/${id}`, data);
  return response.data;
};

export const deleteTicket = async (id) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};