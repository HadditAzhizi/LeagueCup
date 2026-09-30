'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress" title={`${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const [leagues, setLeagues] = useState(null);
  const [cups, setCups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.listLeagues(), api.listCups()])
      .then(([l, c]) => {
        setLeagues(l);
        setCups(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Kelola kompetisi liga dan cup sepak bola Anda.</div>
        </div>
        <div className="btn-row">
          <Link href="/leagues/new" className="btn primary">+ Buat Liga</Link>
          <Link href="/cups/new" className="btn primary">+ Buat Cup</Link>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="section-title">
        <h2>🏆 Liga</h2>
        {leagues && <span className="muted small">{leagues.length} liga</span>}
      </div>
      {!leagues && !error && <p className="muted">Memuat…</p>}
      {leagues?.length === 0 && (
        <div className="empty">
          Belum ada liga. <Link href="/leagues/new" style={{ color: 'var(--primary)', fontWeight: 600 }}>Buat liga pertama</Link>
        </div>
      )}
      {leagues?.length > 0 && (
        <div className="grid">
          {leagues.map((l) => (
            <Link key={l.id} href={`/leagues/${l.id}`} className="card item-card">
              <div className="title">{l.name}</div>
              {l.season && <div className="muted small">Musim {l.season}</div>}
              <div className="meta">
                <span>{l.teamCount} tim</span>
                <span>{l.playedCount}/{l.matchCount} laga</span>
                {l.leader && <span className="badge green">Pemuncak: {l.leader}</span>}
              </div>
              <Progress done={l.playedCount} total={l.matchCount} />
            </Link>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>🥇 Cup</h2>
        {cups && <span className="muted small">{cups.length} cup</span>}
      </div>
      {!cups && !error && <p className="muted">Memuat…</p>}
      {cups?.length === 0 && (
        <div className="empty">
          Belum ada cup. <Link href="/cups/new" style={{ color: 'var(--primary)', fontWeight: 600 }}>Buat cup pertama</Link>
        </div>
      )}
      {cups?.length > 0 && (
        <div className="grid">
          {cups.map((c) => (
            <Link key={c.id} href={`/cups/${c.id}`} className="card item-card">
              <div className="title">{c.name}</div>
              {c.season && <div className="muted small">Musim {c.season}</div>}
              <div className="meta">
                <span>{c.teamCount} tim</span>
                <span>{c.playedCount}/{c.matchCount} laga</span>
                {c.champion ? (
                  <span className="badge gold">🏆 {c.champion}</span>
                ) : (
                  c.currentRound && <span className="badge green">{c.currentRound}</span>
                )}
              </div>
              <Progress done={c.playedCount} total={c.matchCount} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
