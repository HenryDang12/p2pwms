import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://p2pwms-1.onrender.com').replace(/\/$/, '');
const API_URL = `${API_BASE_URL}/api`;
const TOKEN_KEY = 'p2p_wms_access_token';

export const getAccessToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setAccessToken = (token) => {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && getAccessToken() && !String(error.config?.url || '').includes('/auth/login')) {
      setAccessToken(null);
      window.dispatchEvent(new CustomEvent('p2p-wms-session-expired'));
    }
    return Promise.reject(error);
  }
);

export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  setAccessToken(response.data.token);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data.user;
};

export const logout = async () => {
  try {
    if (getAccessToken()) await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
};

export const fetchUsers = async () => (await api.get('/auth/users')).data;
export const createUser = async (data) => (await api.post('/auth/users', data)).data;
export const updateUser = async (id, data) => (await api.patch(`/auth/users/${id}`, data)).data;

export const fetchTickets = async () => (await api.get('/tickets')).data;
export const createInboundTicket = async (data) => (await api.post('/tickets/inbound', data)).data;
export const submitOutboundTicket = async (id, data) => (await api.post(`/tickets/${id}/outbound`, data)).data;
export const updateTicket = async (id, data) => (await api.put(`/tickets/${id}`, data)).data;
export const deleteTicket = async (id) => (await api.delete(`/tickets/${id}`)).data;
