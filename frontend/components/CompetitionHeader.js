'use client';

import { useState } from 'react';

/** Title block with inline rename and delete for a league or cup. */
export default function CompetitionHeader({ kind, item, subtitle, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [season, setSeason] = useState(item.season);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ name, season });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Hapus ${kind} "${item.name}"? Semua data pertandingan akan hilang.`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form className="card form-card" onSubmit={save} style={{ marginBottom: 'var(--s6)' }}>
        {error && <div className="alert error">{error}</div>}
        <div className="row">
          <div className="field">
            <label>Nama {kind}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Musim</label>
            <input type="text" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>Simpan</button>
          <button
            type="button"
            className="btn"
            onClick={() => { setEditing(false); setName(item.name); setSeason(item.season); }}
          >
            Batal
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="page-head">
        <div>
          <h1>{item.name}</h1>
          <div className="sub">
            {item.season && <>Musim {item.season} · </>}
            {subtitle}
          </div>
        </div>
        <div className="btn-row">
          <button className="btn sm" onClick={() => setEditing(true)} disabled={busy}>✏️ Ubah</button>
          <button className="btn sm danger" onClick={remove} disabled={busy}>🗑 Hapus</button>
        </div>
      </div>
    </>
  );
}
