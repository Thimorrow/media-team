export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('Keine Verbindung. Bitte prüfe dein Internet und versuche es erneut.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.', response.status);
  return data as T;
}
