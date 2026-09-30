// API routes live in this Next.js app (app/api), so calls are same-origin.

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error(`Tidak dapat terhubung ke API. Pastikan backend berjalan.`);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
  return data;
}

export const api = {
  listLeagues: () => request('/leagues'),
  getLeague: (id) => request(`/leagues/${id}`),
  createLeague: (body) => request('/leagues', { method: 'POST', body }),
  updateLeague: (id, body) => request(`/leagues/${id}`, { method: 'PUT', body }),
  deleteLeague: (id) => request(`/leagues/${id}`, { method: 'DELETE' }),
  saveLeagueMatch: (id, matchId, body) => request(`/leagues/${id}/matches/${matchId}`, { method: 'PUT', body }),

  listCups: () => request('/cups'),
  getCup: (id) => request(`/cups/${id}`),
  createCup: (body) => request('/cups', { method: 'POST', body }),
  updateCup: (id, body) => request(`/cups/${id}`, { method: 'PUT', body }),
  deleteCup: (id) => request(`/cups/${id}`, { method: 'DELETE' }),
  saveCupMatch: (id, matchId, body) => request(`/cups/${id}/matches/${matchId}`, { method: 'PUT', body }),
};

/** Turn a textarea (one team per line, or comma-separated) into names. */
export function parseTeamNames(text) {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
