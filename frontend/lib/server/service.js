import { read, write, storageName } from './db';
import { generateLeagueFixtures, computeStandings } from './league';
import { generateCupBracket, propagate, findMatch, decideWinner, champion, clearResult } from './cup';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap a route handler: resolves dynamic params and turns errors into JSON. */
export function handle(fn) {
  return async (req, ctx) => {
    try {
      const params = (await ctx?.params) ?? {};
      let body = {};
      if (req.method === 'POST' || req.method === 'PUT') {
        body = await req.json().catch(() => {
          throw new HttpError(400, 'Body harus berupa JSON');
        });
      }
      const result = await fn({ params, body: body ?? {} });
      if (result === undefined) return new Response(null, { status: 204 });
      const status = req.method === 'POST' ? 201 : 200;
      return Response.json(result, { status });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return Response.json({ error: status >= 500 ? 'Terjadi kesalahan server' : err.message }, { status });
    }
  };
}

function parseTeams(input) {
  if (!Array.isArray(input)) throw new HttpError(400, 'teams harus berupa array nama tim');
  const names = input.map((n) => String(n ?? '').trim()).filter(Boolean);
  if (names.length < 2) throw new HttpError(400, 'Minimal 2 tim');
  if (names.length > 64) throw new HttpError(400, 'Maksimal 64 tim');
  const seen = new Set();
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key)) throw new HttpError(400, `Nama tim duplikat: ${n}`);
    seen.add(key);
  }
  return names.map((name) => ({ id: crypto.randomUUID(), name }));
}

function requireName(name) {
  const v = String(name ?? '').trim();
  if (!v) throw new HttpError(400, 'Nama wajib diisi');
  return v;
}

/** Parse a score: null/'' clears it, otherwise must be an integer 0..99. */
function parseScore(v, label) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new HttpError(400, `${label} harus bilangan bulat 0-99`);
  return n;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const now = () => new Date().toISOString();

// ---------- Leagues ----------

function leagueSummary(l) {
  const played = l.matches.filter((m) => m.played).length;
  const leader = played ? computeStandings(l)[0]?.name : null;
  return {
    id: l.id, name: l.name, season: l.season, createdAt: l.createdAt,
    teamCount: l.teams.length, matchCount: l.matches.length, playedCount: played, leader,
  };
}

const leagueDetail = (l) => ({ ...l, standings: computeStandings(l) });

function getLeague(data, id) {
  const l = data.leagues.find((x) => x.id === id);
  if (!l) throw new HttpError(404, 'Liga tidak ditemukan');
  return l;
}

export async function listLeagues() {
  const data = await read();
  return data.leagues.map(leagueSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createLeague(body) {
  const { name, season, teams, doubleRoundRobin = false, shuffleTeams = false } = body;
  const s = body.settings ?? {};
  const pts = (v, d) => (v === undefined || v === '' ? d : parseScore(v, 'Poin'));
  let teamList = parseTeams(teams);
  if (shuffleTeams) teamList = shuffle(teamList);

  const league = {
    id: crypto.randomUUID(),
    name: requireName(name),
    season: String(season ?? '').trim(),
    teams: teamList,
    settings: {
      doubleRoundRobin: Boolean(doubleRoundRobin),
      pointsWin: pts(s.pointsWin, 3),
      pointsDraw: pts(s.pointsDraw, 1),
      pointsLoss: pts(s.pointsLoss, 0),
    },
    matches: generateLeagueFixtures(teamList, Boolean(doubleRoundRobin)),
    createdAt: now(),
    updatedAt: now(),
  };
  await write((data) => { data.leagues.push(league); });
  return leagueDetail(league);
}

export async function getLeagueDetail(id) {
  return leagueDetail(getLeague(await read(), id));
}

export async function updateLeague(id, body) {
  const league = await write((data) => {
    const l = getLeague(data, id);
    if (body.name !== undefined) l.name = requireName(body.name);
    if (body.season !== undefined) l.season = String(body.season).trim();
    l.updatedAt = now();
    return l;
  });
  return leagueDetail(league);
}

export async function deleteLeague(id) {
  await write((data) => {
    getLeague(data, id);
    data.leagues = data.leagues.filter((x) => x.id !== id);
  });
}

export async function saveLeagueMatch(id, matchId, body) {
  const league = await write((data) => {
    const l = getLeague(data, id);
    const m = l.matches.find((x) => x.id === matchId);
    if (!m) throw new HttpError(404, 'Pertandingan tidak ditemukan');
    const hs = parseScore(body.homeScore, 'Skor kandang');
    const as = parseScore(body.awayScore, 'Skor tandang');
    if ((hs === null) !== (as === null)) throw new HttpError(400, 'Isi kedua skor, atau kosongkan keduanya');
    m.homeScore = hs;
    m.awayScore = as;
    m.played = hs !== null;
    l.updatedAt = now();
    return l;
  });
  return leagueDetail(league);
}

// ---------- Cups ----------

function cupSummary(c) {
  const all = c.rounds.flatMap((r) => r.matches).filter((m) => !m.bye);
  const championId = champion(c);
  const current = c.rounds.find((r) => r.matches.some((m) => !m.bye && !m.played));
  return {
    id: c.id, name: c.name, season: c.season, createdAt: c.createdAt,
    teamCount: c.teams.length, matchCount: all.length, playedCount: all.filter((m) => m.played).length,
    currentRound: championId ? null : current?.name ?? null,
    champion: c.teams.find((t) => t.id === championId)?.name ?? null,
  };
}

const cupDetail = (c) => ({ ...c, championId: champion(c) });

function getCup(data, id) {
  const c = data.cups.find((x) => x.id === id);
  if (!c) throw new HttpError(404, 'Cup tidak ditemukan');
  return c;
}

export async function listCups() {
  const data = await read();
  return data.cups.map(cupSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCup(body) {
  const { name, season, teams, shuffleTeams = false } = body;
  let teamList = parseTeams(teams);
  if (shuffleTeams) teamList = shuffle(teamList);
  const cup = {
    id: crypto.randomUUID(),
    name: requireName(name),
    season: String(season ?? '').trim(),
    teams: teamList,
    rounds: generateCupBracket(teamList),
    createdAt: now(),
    updatedAt: now(),
  };
  await write((data) => { data.cups.push(cup); });
  return cupDetail(cup);
}

export async function getCupDetail(id) {
  return cupDetail(getCup(await read(), id));
}

export async function updateCup(id, body) {
  const cup = await write((data) => {
    const c = getCup(data, id);
    if (body.name !== undefined) c.name = requireName(body.name);
    if (body.season !== undefined) c.season = String(body.season).trim();
    c.updatedAt = now();
    return c;
  });
  return cupDetail(cup);
}

export async function deleteCup(id) {
  await write((data) => {
    getCup(data, id);
    data.cups = data.cups.filter((x) => x.id !== id);
  });
}

export async function saveCupMatch(id, matchId, body) {
  const cup = await write((data) => {
    const c = getCup(data, id);
    const m = findMatch(c, matchId);
    if (!m) throw new HttpError(404, 'Pertandingan tidak ditemukan');
    if (m.bye) throw new HttpError(400, 'Pertandingan bye tidak bisa diubah');
    if (!m.homeId || !m.awayId) throw new HttpError(400, 'Kedua tim belum ditentukan');

    const hs = parseScore(body.homeScore, 'Skor kandang');
    const as = parseScore(body.awayScore, 'Skor tandang');
    if ((hs === null) !== (as === null)) throw new HttpError(400, 'Isi kedua skor, atau kosongkan keduanya');

    if (hs === null) {
      clearResult(m);
    } else {
      m.homeScore = hs;
      m.awayScore = as;
      if (hs === as) {
        m.homePens = parseScore(body.homePens, 'Adu penalti kandang');
        m.awayPens = parseScore(body.awayPens, 'Adu penalti tandang');
      } else {
        m.homePens = m.awayPens = null;
      }
      const winner = decideWinner(m);
      if (!winner) throw new HttpError(400, 'Skor imbang: isi skor adu penalti dengan pemenang yang jelas');
      m.winnerId = winner;
      m.played = true;
    }
    propagate(c.rounds);
    c.updatedAt = now();
    return c;
  });
  return cupDetail(cup);
}

export async function health() {
  await read();
  return { ok: true, storage: storageName() };
}
