'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import CompetitionHeader from '@/components/CompetitionHeader';
import { downloadStandings, shareStandings, canShareFiles } from '@/lib/standingsImage';

function TeamLabel({ name, on }) {
  return on ? <mark className="hl">{name}</mark> : name;
}

function FixtureRow({ match, teamName, onSave, highlight }) {
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
    <div>
      <form
        className={`fixture${match.played ? ' played' : ''}`}
        onSubmit={(e) => { e.preventDefault(); save(home, away); }}
      >
        <div className="home"><TeamLabel name={teamName(match.homeId)} on={highlight?.has(match.homeId)} /></div>
        <div className="score-inputs">
          <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" max="99" value={home} onChange={(e) => setHome(e.target.value)} aria-label="Skor kandang" />
          <span className="sep">–</span>
          <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" max="99" value={away} onChange={(e) => setAway(e.target.value)} aria-label="Skor tandang" />
        </div>
        <div className="away"><TeamLabel name={teamName(match.awayId)} on={highlight?.has(match.awayId)} /></div>
        <div className="actions">
          <button className="btn sm primary" disabled={busy || !dirty || home === '' || away === ''} title="Simpan" aria-label="Simpan">
            <span className="ico">✓</span><span className="txt">Simpan</span>
          </button>
          {match.played && (
            <button type="button" className="btn sm icon" disabled={busy} onClick={() => save(null, null)} title="Hapus hasil" aria-label="Hapus hasil">
              ✕
            </button>
          )}
        </div>
      </form>
      {error && <div className="alert error fixture-error">{error}</div>}
    </div>
  );
}

export default function LeagueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('standings');
  const [query, setQuery] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => setCanShare(canShareFiles()), []);

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

  const q = query.trim().toLowerCase();
  const found = q ? new Set(league.teams.filter((t) => t.name.toLowerCase().includes(q)).map((t) => t.id)) : null;
  const involves = (m) => !found || found.has(m.homeId) || found.has(m.awayId);
  const standings = found ? league.standings.filter((r) => found.has(r.teamId)) : league.standings;
  const visibleRounds = rounds
    .map(([r, ms]) => [r, ms, ms.filter(involves)])
    .filter(([, ms, shown]) => !found || shown.length > 0 || league.teams.some((t) => found.has(t.id) && !ms.some((m) => m.homeId === t.id || m.awayId === t.id)));

  async function exportImage(share) {
    setExporting(true);
    try {
      if (!share || !(await shareStandings(league))) await downloadStandings(league);
    } catch (err) {
      alert(`Gagal membuat gambar: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

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

      <div className="search-bar">
        <div className="search-field">
          <span className="search-icon" aria-hidden>🔍</span>
          <input
            type="search"
            list="club-list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari klub…"
            aria-label="Cari klub"
          />
        </div>
        <datalist id="club-list">
          {league.teams.map((t) => <option key={t.id} value={t.name} />)}
        </datalist>
        {query && <button type="button" className="btn sm" onClick={() => setQuery('')}>Hapus</button>}
        {found && <span className="muted small">{found.size} klub cocok</span>}
      </div>

      <div className="tabs">
        <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>Klasemen</button>
        <button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>Jadwal &amp; Hasil</button>
      </div>

      {tab === 'standings' && (
        <div className="card">
          <div className="card-toolbar">
            {found && <span className="muted small">Gambar selalu berisi klasemen lengkap.</span>}
            <button className="btn sm" onClick={() => exportImage(false)} disabled={exporting}>
              ⬇ Download gambar
            </button>
            {canShare && (
              <button className="btn sm" onClick={() => exportImage(true)} disabled={exporting}>
                📤 Bagikan
              </button>
            )}
          </div>
          <div className="table-scroll">
          <table className="standings">
            <thead>
              <tr>
                <th>#</th>
                <th className="team">Tim</th>
                <th title="Main">Main</th>
                <th title="Menang">M</th>
                <th title="Seri">S</th>
                <th title="Kalah">K</th>
                <th className="hide-sm" title="Gol memasukkan">GM</th>
                <th className="hide-sm" title="Gol kemasukan">GK</th>
                <th title="Selisih gol">SG</th>
                <th>Poin</th>
                <th className="hide-md">5 Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.teamId}>
                  <td className="pos">{r.position}</td>
                  <td className="team"><TeamLabel name={r.name} on={!!found} /></td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td className="hide-sm">{r.gf}</td>
                  <td className="hide-sm">{r.ga}</td>
                  <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="pts">{r.points}</td>
                  <td className="hide-md">
                    <span className="form">
                      {r.form.map((f, i) => (
                        <span key={i} className={f}>{f === 'W' ? 'M' : f === 'D' ? 'S' : 'K'}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr><td colSpan={11} className="muted">Tidak ada klub yang cocok dengan “{query}”.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <p className="muted small card-note">
            Main = jumlah laga · M/S/K = menang/seri/kalah
            <span className="hide-sm"> · GM/GK = gol memasukkan/kemasukan</span> · SG = selisih gol.
            Poin: menang {league.settings.pointsWin}, seri {league.settings.pointsDraw}, kalah {league.settings.pointsLoss}.
            Urutan: poin → selisih gol → gol memasukkan → jumlah menang.
          </p>
        </div>
      )}

      {tab === 'fixtures' && found && visibleRounds.length === 0 && (
        <div className="empty">Tidak ada klub yang cocok dengan “{query}”.</div>
      )}
      {tab === 'fixtures' &&
        visibleRounds.map(([r, ms, shown]) => {
          const resting = league.teams.filter(
            (t) => (!found || found.has(t.id)) && !ms.some((m) => m.homeId === t.id || m.awayId === t.id),
          );
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
              <div className="fixture-list">
              {shown.map((m) => (
                <FixtureRow
                  key={`${m.id}-${m.homeScore}-${m.awayScore}`}
                  match={m}
                  teamName={teamName}
                  onSave={saveMatch}
                  highlight={found}
                />
              ))}
              </div>
            </div>
          );
        })}
    </>
  );
}
