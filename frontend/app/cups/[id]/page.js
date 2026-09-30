'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import CompetitionHeader from '@/components/CompetitionHeader';

const str = (v) => (v === null || v === undefined ? '' : String(v));

function BracketMatch({ match, teamName, onSave }) {
  const [hs, setHs] = useState(str(match.homeScore));
  const [as, setAs] = useState(str(match.awayScore));
  const [hp, setHp] = useState(str(match.homePens));
  const [ap, setAp] = useState(str(match.awayPens));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (match.bye) {
    return (
      <div className="bmatch bye">
        <div className="slot winner"><span className="name">{teamName(match.homeId)}</span></div>
        <div className="slot"><span className="name tbd">bye</span></div>
      </div>
    );
  }

  const ready = match.homeId && match.awayId;
  const isDraw = hs !== '' && hs === as;
  const dirty =
    hs !== str(match.homeScore) || as !== str(match.awayScore) ||
    (isDraw && (hp !== str(match.homePens) || ap !== str(match.awayPens)));

  async function save(body) {
    setBusy(true);
    setError('');
    try {
      await onSave(match.id, body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const slot = (teamId, value, setValue, pens) => {
    const won = match.played && match.winnerId === teamId;
    return (
      <div className={`slot${won ? ' winner' : ''}`}>
        <span className={`name${teamId ? '' : ' tbd'}`}>{teamId ? teamName(teamId) : 'Menunggu pemenang'}</span>
        {match.played && pens !== null && <span className="pen">({pens})</span>}
        {ready && (
          <input
            type="number"
            min="0"
            max="99"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`Skor ${teamName(teamId)}`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="bmatch">
      {slot(match.homeId, hs, setHs, match.homePens)}
      {slot(match.awayId, as, setAs, match.awayPens)}
      {ready && (
        <div className="foot">
          {isDraw ? (
            <span className="pens">
              Penalti
              <input type="number" min="0" max="99" value={hp} onChange={(e) => setHp(e.target.value)} aria-label="Penalti kandang" />
              –
              <input type="number" min="0" max="99" value={ap} onChange={(e) => setAp(e.target.value)} aria-label="Penalti tandang" />
            </span>
          ) : (
            <span className="muted">{match.played ? 'Selesai' : 'Belum dimainkan'}</span>
          )}
          <span className="btn-row">
            <button
              className="btn sm primary"
              disabled={busy || !dirty || hs === '' || as === ''}
              onClick={() => save({ homeScore: hs, awayScore: as, homePens: hp, awayPens: ap })}
            >
              Simpan
            </button>
            {match.played && (
              <button className="btn sm" disabled={busy} title="Hapus hasil" onClick={() => save({ homeScore: null, awayScore: null })}>
                ✕
              </button>
            )}
          </span>
        </div>
      )}
      {error && <div className="alert error" style={{ margin: 8 }}>{error}</div>}
    </div>
  );
}

export default function CupDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [cup, setCup] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCup(id).then(setCup).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <>
        <div className="alert error">{error}</div>
        <Link href="/" className="btn">← Kembali</Link>
      </>
    );
  }
  if (!cup) return <p className="muted">Memuat…</p>;

  const names = new Map(cup.teams.map((t) => [t.id, t.name]));
  const teamName = (tid) => names.get(tid) ?? '?';
  const real = cup.rounds.flatMap((r) => r.matches).filter((m) => !m.bye);
  const played = real.filter((m) => m.played).length;

  async function saveMatch(matchId, body) {
    setCup(await api.saveCupMatch(id, matchId, body));
  }

  return (
    <>
      <CompetitionHeader
        kind="cup"
        item={cup}
        subtitle={`${cup.teams.length} tim · ${played}/${real.length} laga dimainkan · Sistem gugur`}
        onSave={async (body) => setCup(await api.updateCup(id, body))}
        onDelete={async () => { await api.deleteCup(id); router.push('/'); }}
      />

      {cup.championId && (
        <div className="champion">
          <span className="trophy">🏆</span>
          <div>
            <div className="label">Juara</div>
            <div className="team">{teamName(cup.championId)}</div>
          </div>
        </div>
      )}

      <div className="alert info small">
        Isi skor lalu klik Simpan. Jika imbang, isi skor adu penalti. Mengubah hasil babak awal akan mereset laga
        lanjutan yang terpengaruh.
      </div>

      <div className="card">
        <div className="bracket">
          {cup.rounds.map((round) => (
            <div className="bracket-round" key={round.name}>
              <h3>{round.name}</h3>
              <div className="bracket-matches">
                {round.matches.map((m) => (
                  <BracketMatch
                    key={[m.id, m.homeId, m.awayId, m.homeScore, m.awayScore, m.homePens, m.awayPens].join('-')}
                    match={m}
                    teamName={teamName}
                    onSave={saveMatch}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
