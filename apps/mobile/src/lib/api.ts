// La URL es pública y se incorpora al compilar. Los tokens solo se envían por cabecera.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://paneljaguar.sgaldos.com/api';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function apiRequest<T>(path: string, token?: string, body?: object): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET', signal: controller.signal,
      headers: { 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('El servidor no ha enviado una respuesta válida.'); }
    if (!response.ok) throw new ApiError(data.error || 'No se pudo completar la solicitud.', response.status);
    return data;
  } finally { clearTimeout(timeout); }
}
export const errorMessage = (error: unknown) => error instanceof ApiError ? error.message
  : 'No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.';
