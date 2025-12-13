import axios from "axios";
import { getSessionId, getUserEmail } from "../utils/session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

export const sendMessage = async (text) => {
  const payload = {
    text,
    sessionId: getSessionId()
  };

  const email = getUserEmail();
  if (email) payload.email = email;

  const res = await api.post("/webhook", payload);
  return res.data;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("API Error:", err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;
