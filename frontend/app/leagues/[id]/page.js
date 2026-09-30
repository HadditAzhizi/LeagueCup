'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import CompetitionHeader from '@/components/CompetitionHeader';

function FixtureRow({ match, teamName, onSave }) {
  const [home, setHome] = useState(match.homeScore ?? '');
  const [away, setAway] = useState(match.awayScore ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = String(home) !== String(match.homeScore ?? '') || String(away) !== String(match.awayScore ?? '');

  async function save(homeScore, awayScore) {
    setBusy(true);
    setError('');
    try {
      await onSave(match.id, { homeScore, awayScore });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className={`fixture${match.played ? ' played' : ''}`}
        onSubmit={(e) => { e.preventDefault(); save(home, away); }}
      >
        <div className="home">{teamName(match.homeId)}</div>
        <div className="score-inputs">
          <input type="number" min="0" max="99" value={home} onChange={(e) => setHome(e.target.value)} aria-label="Skor kandang" />
          <span className="sep">–</span>
          <input type="number" min="0" max="99" value={away} onChange={(e) => setAway(e.target.value)} aria-label="Skor tandang" />
        </div>
        <div className="away">{teamName(match.awayId)}</div>
        <div className="actions btn-row">
          <button className="btn sm primary" disabled={busy || !dirty || home === '' || away === ''}>Simpan</button>
          {match.played && (
            <button type="button" className="btn sm" disabled={busy} onClick={() => save(null, null)} title="Hapus hasil">
              ✕
            </button>
          )}
        </div>
      </form>
      {error && <div className="alert error" style={{ marginTop: 6 }}>{error}</div>}
    </>
  );
}

export default function LeagueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('standings');

  useEffect(() => {
    api.getLeague(id).then(setLeague).catch((e) => setError(e.message));
  }, [id]);

  const rounds = useMemo(() => {
    if (!league) return [];
    const map = new Map();
    for (const m of league.matches) {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round).push(m);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [league]);

  if (error) {
    return (
      <>
        <div className="alert error">{error}</div>
        <Link href="/" className="btn">← Kembali</Link>
      </>
    );
  }
  if (!league) return <p className="muted">Memuat…</p>;

  const names = new Map(league.teams.map((t) => [t.id, t.name]));
  const teamName = (tid) => names.get(tid) ?? '?';
  const played = league.matches.filter((m) => m.played).length;

  async function saveMatch(matchId, body) {
    setLeague(await api.saveLeagueMatch(id, matchId, body));
  }

  return (
    <>
      <CompetitionHeader
        kind="liga"
        item={league}
        subtitle={`${league.teams.length} tim · ${played}/${league.matches.length} laga dimainkan · ${
          league.settings.doubleRoundRobin ? 'Kandang & tandang' : 'Satu putaran'
        }`}
        onSave={async (body) => setLeague(await api.updateLeague(id, body))}
        onDelete={async () => { await api.deleteLeague(id); router.push('/'); }}
      />

      <div className="tabs">
        <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>Klasemen</button>
        <button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>Jadwal &amp; Hasil</button>
      </div>

      {tab === 'standings' && (
        <div className="card table-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th>#</th>
                <th className="team">Tim</th>
                <th title="Main">M</th>
                <th title="Menang">M</th>
                <th title="Seri">S</th>
                <th title="Kalah">K</th>
                <th title="Gol memasukkan">GM</th>
                <th title="Gol kemasukan">GK</th>
                <th title="Selisih gol">SG</th>
                <th>Poin</th>
                <th>5 Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {league.standings.map((r) => (
                <tr key={r.teamId}>
                  <td className="pos">{r.position}</td>
                  <td className="team">{r.name}</td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td>{r.gf}</td>
                  <td>{r.ga}</td>
                  <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="pts">{r.points}</td>
                  <td>
                    <span className="form">
                      {r.form.map((f, i) => (
                        <span key={i} className={f}>{f === 'W' ? 'M' : f === 'D' ? 'S' : 'K'}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Poin: menang {league.settings.pointsWin}, seri {league.settings.pointsDraw}, kalah {league.settings.pointsLoss}.
            Urutan: poin → selisih gol → gol memasukkan → jumlah menang.
          </p>
        </div>
      )}

      {tab === 'fixtures' &&
        rounds.map(([r, ms]) => {
          const resting = league.teams.filter((t) => !ms.some((m) => m.homeId === t.id || m.awayId === t.id));
          const done = ms.filter((m) => m.played).length;
          return (
            <div className="card" key={r}>
              <div className="round-head">
                <h2>Pekan {r}</h2>
                <span className={`badge${done === ms.length ? ' green' : ''}`}>
                  {done === ms.length ? '✓ Selesai' : `${done}/${ms.length} laga`}
                </span>
                {resting.length > 0 && (
                  <span className="muted small">Libur: {resting.map((t) => t.name).join(', ')}</span>
                )}
              </div>
              {ms.map((m) => (
                <FixtureRow
                  key={`${m.id}-${m.homeScore}-${m.awayScore}`}
                  match={m}
                  teamName={teamName}
                  onSave={saveMatch}
                />
              ))}
            </div>
          );
        })}
    </>
  );
}
