import axios from "axios";

/* =============================
   GLOBAL BACKEND CONFIG
   ============================= */

const BACKEND_IP = "10.4.1.152";
const BACKEND_PORT = "5000";

export const BASE_URL = `http://${BACKEND_IP}:${BACKEND_PORT}`;
export const API_URL = `${BASE_URL}/api`;
export const UPLOADS_URL = `${BASE_URL}/uploads`;

/* =============================
   AXIOS INSTANCE
   ============================= */

const API = axios.create({
  baseURL: API_URL,
});

/* =============================
   ADD TOKEN TO EVERY REQUEST
   ============================= */

API.interceptors.request.use((req) => {

  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;

}, (error) => {
  return Promise.reject(error);
});

export default API;