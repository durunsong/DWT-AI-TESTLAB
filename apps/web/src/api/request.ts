import axios from "axios";
import { getApiBaseUrl } from "./base-url";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "./timeouts";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const request = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: Number(import.meta.env.VITE_APP_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS)
});

request.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown>;
    if (payload && typeof payload === "object" && "code" in payload) {
      if (payload.code !== 0) {
        return Promise.reject(new Error(payload.message || "请求失败"));
      }
      return payload.data;
    }
    return response.data;
  },
  (error) => Promise.reject(error)
);
