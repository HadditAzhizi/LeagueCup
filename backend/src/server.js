import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { read, write, storageName } from './db.js';
import { generateLeagueFixtures, computeStandings } from './league.js';
import { generateCupBracket, propagate, findMatch, decideWinner, champion, clearResult } from './cup.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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
  return names.map((name) => ({ id: randomUUID(), name }));
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

// ---------- Leagues ----------

function leagueSummary(l) {
  const played = l.matches.filter((m) => m.played).length;
  const leader = played ? computeStandings(l)[0]?.name : null;
  return {
    id: l.id, name: l.name, season: l.season, createdAt: l.createdAt,
    teamCount: l.teams.length, matchCount: l.matches.length, playedCount: played, leader,
  };
}

function leagueDetail(l) {
  return { ...l, standings: computeStandings(l) };
}

function getLeague(data, id) {
  const l = data.leagues.find((x) => x.id === id);
  if (!l) throw new HttpError(404, 'Liga tidak ditemukan');
  return l;
}

app.get('/api/leagues', wrap(async (_req, res) => {
  const data = await read();
  res.json(data.leagues.map(leagueSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));

app.post('/api/leagues', wrap(async (req, res) => {
  const { name, season, teams, doubleRoundRobin = false, shuffleTeams = false } = req.body ?? {};
  const s = req.body?.settings ?? {};
  const pts = (v, d) => (v === undefined || v === '' ? d : parseScore(v, 'Poin'));
  let teamList = parseTeams(teams);
  if (shuffleTeams) teamList = shuffle(teamList);

  const league = {
    id: randomUUID(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await write((data) => { data.leagues.push(league); });
  res.status(201).json(leagueDetail(league));
}));

app.get('/api/leagues/:id', wrap(async (req, res) => {
  res.json(leagueDetail(getLeague(await read(), req.params.id)));
}));

app.put('/api/leagues/:id', wrap(async (req, res) => {
  const league = await write((data) => {
    const l = getLeague(data, req.params.id);
    if (req.body.name !== undefined) l.name = requireName(req.body.name);
    if (req.body.season !== undefined) l.season = String(req.body.season).trim();
    l.updatedAt = new Date().toISOString();
    return l;
  });
  res.json(leagueDetail(league));
}));

app.delete('/api/leagues/:id', wrap(async (req, res) => {
  await write((data) => {
    getLeague(data, req.params.id);
    data.leagues = data.leagues.filter((x) => x.id !== req.params.id);
  });
  res.status(204).end();
}));

app.put('/api/leagues/:id/matches/:matchId', wrap(async (req, res) => {
  const league = await write((data) => {
    const l = getLeague(data, req.params.id);
    const m = l.matches.find((x) => x.id === req.params.matchId);
    if (!m) throw new HttpError(404, 'Pertandingan tidak ditemukan');
    const hs = parseScore(req.body.homeScore, 'Skor kandang');
    const as = parseScore(req.body.awayScore, 'Skor tandang');
    if ((hs === null) !== (as === null)) throw new HttpError(400, 'Isi kedua skor, atau kosongkan keduanya');
    m.homeScore = hs;
    m.awayScore = as;
    m.played = hs !== null;
    l.updatedAt = new Date().toISOString();
    return l;
  });
  res.json(leagueDetail(league));
}));

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

function cupDetail(c) {
  return { ...c, championId: champion(c) };
}

function getCup(data, id) {
  const c = data.cups.find((x) => x.id === id);
  if (!c) throw new HttpError(404, 'Cup tidak ditemukan');
  return c;
}

app.get('/api/cups', wrap(async (_req, res) => {
  const data = await read();
  res.json(data.cups.map(cupSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));

app.post('/api/cups', wrap(async (req, res) => {
  const { name, season, teams, shuffleTeams = false } = req.body ?? {};
  let teamList = parseTeams(teams);
  if (shuffleTeams) teamList = shuffle(teamList);
  const cup = {
    id: randomUUID(),
    name: requireName(name),
    season: String(season ?? '').trim(),
    teams: teamList,
    rounds: generateCupBracket(teamList),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await write((data) => { data.cups.push(cup); });
  res.status(201).json(cupDetail(cup));
}));

app.get('/api/cups/:id', wrap(async (req, res) => {
  res.json(cupDetail(getCup(await read(), req.params.id)));
}));

app.put('/api/cups/:id', wrap(async (req, res) => {
  const cup = await write((data) => {
    const c = getCup(data, req.params.id);
    if (req.body.name !== undefined) c.name = requireName(req.body.name);
    if (req.body.season !== undefined) c.season = String(req.body.season).trim();
    c.updatedAt = new Date().toISOString();
    return c;
  });
  res.json(cupDetail(cup));
}));

app.delete('/api/cups/:id', wrap(async (req, res) => {
  await write((data) => {
    getCup(data, req.params.id);
    data.cups = data.cups.filter((x) => x.id !== req.params.id);
  });
  res.status(204).end();
}));

app.put('/api/cups/:id/matches/:matchId', wrap(async (req, res) => {
  const cup = await write((data) => {
    const c = getCup(data, req.params.id);
    const m = findMatch(c, req.params.matchId);
    if (!m) throw new HttpError(404, 'Pertandingan tidak ditemukan');
    if (m.bye) throw new HttpError(400, 'Pertandingan bye tidak bisa diubah');
    if (!m.homeId || !m.awayId) throw new HttpError(400, 'Kedua tim belum ditentukan');

    const hs = parseScore(req.body.homeScore, 'Skor kandang');
    const as = parseScore(req.body.awayScore, 'Skor tandang');
    if ((hs === null) !== (as === null)) throw new HttpError(400, 'Isi kedua skor, atau kosongkan keduanya');

    if (hs === null) {
      clearResult(m);
    } else {
      m.homeScore = hs;
      m.awayScore = as;
      if (hs === as) {
        m.homePens = parseScore(req.body.homePens, 'Adu penalti kandang');
        m.awayPens = parseScore(req.body.awayPens, 'Adu penalti tandang');
      } else {
        m.homePens = m.awayPens = null;
      }
      const winner = decideWinner(m);
      if (!winner) throw new HttpError(400, 'Skor imbang: isi skor adu penalti dengan pemenang yang jelas');
      m.winnerId = winner;
      m.played = true;
    }
    propagate(c.rounds);
    c.updatedAt = new Date().toISOString();
    return c;
  });
  res.json(cupDetail(cup));
}));

// ---------- Misc ----------

app.get('/api/health', wrap(async (_req, res) => {
  await read();
  res.json({ ok: true, storage: storageName });
}));

app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Terjadi kesalahan server' : err.message });
});

app.listen(PORT, () => console.log(`LeagueCup API berjalan di http://localhost:${PORT} — penyimpanan: ${storageName}`));
