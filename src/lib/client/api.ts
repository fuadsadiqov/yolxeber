import { API_ERRORS } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(API_ERRORS[code] ?? (status === 0 ? "İnternet bağlantısını yoxlayın." : "Xəta baş verdi, yenidən cəhd edin."));
  }
}

/** JSON API sorğusu. Xəta halında istifadəçiyə göstəriləcək mətnli ApiError atır. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("network", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "server_error", res.status);
  return data as T;
}

export const qs = (o: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "") as [string, string][]).toString();
