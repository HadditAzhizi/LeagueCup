'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, parseTeamNames } from '@/lib/api';

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [teamsText, setTeamsText] = useState('');
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(true);
  const [shuffleTeams, setShuffleTeams] = useState(false);
  const [points, setPoints] = useState({ pointsWin: 3, pointsDraw: 1, pointsLoss: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const teams = parseTeamNames(teamsText);
  const n = teams.length;
  const roundsPerLeg = n < 2 ? 0 : n % 2 === 0 ? n - 1 : n;
  const matchCount = n < 2 ? 0 : ((n * (n - 1)) / 2) * (doubleRoundRobin ? 2 : 1);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const league = await api.createLeague({ name, season, teams, doubleRoundRobin, shuffleTeams, settings: points });
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Buat Liga Baru</h1>
          <div className="sub">Format round-robin: setiap tim saling bertemu. Jadwal dibuat otomatis.</div>
        </div>
      </div>

      <form className="card form-card" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <div className="row">
          <div className="field">
            <label htmlFor="name">Nama Liga</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Liga Kampung 2026" required />
          </div>
          <div className="field">
            <label htmlFor="season">Musim</label>
            <input id="season" type="text" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="cth. 2026/27" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="teams">Daftar Tim</label>
          <textarea
            id="teams"
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
            placeholder={'Satu tim per baris, contoh:\nPersija\nPersib\nArema\nPersebaya'}
          />
          <span className="hint">
            {n} tim · {roundsPerLeg * (doubleRoundRobin ? 2 : 1)} pekan · {matchCount} pertandingan
            {n % 2 === 1 && n > 1 && ' · jumlah ganjil: satu tim libur tiap pekan'}
          </span>
        </div>

        <div className="options">
        <label className="check">
          <input type="checkbox" checked={doubleRoundRobin} onChange={(e) => setDoubleRoundRobin(e.target.checked)} />
          Kandang &amp; tandang (2 putaran)
        </label>
        <label className="check">
          <input type="checkbox" checked={shuffleTeams} onChange={(e) => setShuffleTeams(e.target.checked)} />
          Acak urutan tim sebelum membuat jadwal
        </label>
        </div>

        <div className="row-3">
          {[
            ['pointsWin', 'Poin Menang'],
            ['pointsDraw', 'Poin Seri'],
            ['pointsLoss', 'Poin Kalah'],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="99"
                value={points[key]}
                onChange={(e) => setPoints({ ...points, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn primary" disabled={busy || n < 2}>{busy ? 'Menyimpan…' : 'Buat & Simpan Liga'}</button>
          <button type="button" className="btn" onClick={() => router.back()}>Batal</button>
        </div>
      </form>
    </>
  );
}
