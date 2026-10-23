import { useState } from "react";
import { api } from "@/api/client";

export function useApi<T>(url: string, options: { method?: string; body?: any } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function run() {
    try {
      setLoading(true);
      const res = await api.request({ url, method: options.method || "GET", data: options.body });
      setData(res.data as T);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  return { data, error, loading, run };
}

export async function apiGet(url: string) {
  const res = await api.get(url);
  return res.data;
}
export async function apiPost(url: string, body: any) {
  const res = await api.post(url, body);
  return res.data;
}
export async function apiPatch(url: string, body: any) {
  const res = await api.patch(url, body);
  return res.data;
}
export async function apiDel(url: string) {
  const res = await api.delete(url);
  return res.data;
}
