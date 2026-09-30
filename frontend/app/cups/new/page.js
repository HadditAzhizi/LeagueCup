'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, parseTeamNames } from '@/lib/api';

export default function NewCupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [teamsText, setTeamsText] = useState('');
  const [shuffleTeams, setShuffleTeams] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const teams = parseTeamNames(teamsText);
  const n = teams.length;
  let size = 2;
  while (size < n) size *= 2;
  const byes = n >= 2 ? size - n : 0;
  const roundCount = n >= 2 ? Math.log2(size) : 0;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cup = await api.createCup({ name, season, teams, shuffleTeams });
      router.push(`/cups/${cup.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Buat Cup Baru</h1>
          <div className="sub">Format gugur (knockout). Seri diselesaikan lewat adu penalti.</div>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <div className="row">
          <div className="field">
            <label htmlFor="name">Nama Cup</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Piala Kemerdekaan" required />
          </div>
          <div className="field">
            <label htmlFor="season">Musim</label>
            <input id="season" type="text" value={season} onChange={(e) => setSeason(e.target.value)} />
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
            {n} tim · {roundCount} babak
            {byes > 0 && ` · ${byes} tim mendapat bye (langsung lolos babak pertama)`}
          </span>
        </div>

        <label className="check">
          <input type="checkbox" checked={shuffleTeams} onChange={(e) => setShuffleTeams(e.target.checked)} />
          Undian acak (jika tidak dicentang, urutan daftar = urutan bagan)
        </label>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={busy || n < 2}>{busy ? 'Menyimpan…' : 'Buat & Simpan Cup'}</button>
          <button type="button" className="btn" onClick={() => router.back()}>Batal</button>
        </div>
      </form>
    </>
  );
}
