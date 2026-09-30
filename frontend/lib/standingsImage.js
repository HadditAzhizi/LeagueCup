// Renders a league's standings table to a PNG, independent of the page
// layout (so it's never cut off on small screens and always uses the
// light theme).

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const C = {
  bg: '#ffffff',
  headA: '#0b5e2f',
  headB: '#0f7a3d',
  text: '#17201b',
  muted: '#5d6b63',
  border: '#e3e8e5',
  zebra: '#f5f8f6',
  primary: '#0f7a3d',
  W: '#1f9d55',
  D: '#8a939a',
  L: '#d0443a',
};

const WIDTH = 900;
const PAD = 28;
const HEADER_H = 112;
const TH_H = 38;
const ROW_H = 44;
const FOOTER_H = 64;

// Numeric columns after the team name.
const COLS = [
  ['Main', 'played'],
  ['M', 'won'],
  ['S', 'drawn'],
  ['K', 'lost'],
  ['GM', 'gf'],
  ['GK', 'ga'],
  ['SG', 'gd'],
  ['Poin', 'points'],
];
const POS_W = 44;
const NUM_W = 50;
const FORM_W = 128;
const TEAM_W = WIDTH - PAD * 2 - POS_W - COLS.length * NUM_W - FORM_W;

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export function renderStandings(league) {
  const rows = league.standings;
  const played = league.matches.filter((m) => m.played).length;
  const height = HEADER_H + 16 + TH_H + rows.length * ROW_H + FOOTER_H;

  const scale = 2; // crisp on phones and when zoomed
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // Header
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEADER_H);
  grad.addColorStop(0, C.headA);
  grad.addColorStop(1, C.headB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(fit(ctx, league.name, WIDTH - PAD * 2), PAD, 44);
  ctx.font = `500 15px ${FONT}`;
  ctx.globalAlpha = 0.9;
  const sub = ['Klasemen', league.season && `Musim ${league.season}`, `${played}/${league.matches.length} laga dimainkan`]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillText(sub, PAD, 80);
  ctx.globalAlpha = 1;

  // Column x positions
  const xPos = PAD + POS_W / 2;
  const xTeam = PAD + POS_W;
  const xNum = (i) => xTeam + TEAM_W + NUM_W * i + NUM_W / 2;
  const xForm = xTeam + TEAM_W + NUM_W * COLS.length + 12;

  // Table header
  let y = HEADER_H + 16;
  ctx.fillStyle = C.muted;
  ctx.font = `700 12px ${FONT}`;
  const thY = y + TH_H / 2;
  ctx.textAlign = 'center';
  ctx.fillText('#', xPos, thY);
  ctx.textAlign = 'left';
  ctx.fillText('TIM', xTeam, thY);
  ctx.textAlign = 'center';
  COLS.forEach(([label], i) => ctx.fillText(label.toUpperCase(), xNum(i), thY));
  ctx.textAlign = 'left';
  ctx.fillText('5 TERAKHIR', xForm, thY);
  y += TH_H;
  ctx.fillStyle = C.border;
  ctx.fillRect(PAD, y - 1, WIDTH - PAD * 2, 1);

  // Rows
  rows.forEach((r, idx) => {
    const cy = y + ROW_H / 2;
    if (idx % 2 === 1) {
      ctx.fillStyle = C.zebra;
      ctx.fillRect(PAD, y, WIDTH - PAD * 2, ROW_H);
    }

    // Leader gets a coloured position badge
    ctx.textAlign = 'center';
    if (r.position === 1) {
      ctx.fillStyle = C.primary;
      ctx.beginPath();
      ctx.arc(xPos, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = C.muted;
    }
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(String(r.position), xPos, cy);

    ctx.textAlign = 'left';
    ctx.fillStyle = C.text;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(fit(ctx, r.name, TEAM_W - 12), xTeam, cy);

    ctx.textAlign = 'center';
    COLS.forEach(([, key], i) => {
      const v = r[key];
      const isPts = key === 'points';
      ctx.font = `${isPts ? 800 : 500} ${isPts ? 17 : 15}px ${FONT}`;
      ctx.fillStyle = isPts ? C.text : C.muted;
      ctx.fillText(key === 'gd' && v > 0 ? `+${v}` : String(v), xNum(i), cy);
    });

    ctx.font = `700 11px ${FONT}`;
    r.form.forEach((f, i) => {
      const bx = xForm + i * 22;
      ctx.fillStyle = C[f];
      ctx.beginPath();
      ctx.roundRect(bx, cy - 9, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(f === 'W' ? 'M' : f === 'D' ? 'S' : 'K', bx + 9, cy + 0.5);
    });

    y += ROW_H;
    ctx.fillStyle = C.border;
    ctx.fillRect(PAD, y - 1, WIDTH - PAD * 2, 1);
  });

  // Footer
  const { pointsWin, pointsDraw, pointsLoss } = league.settings;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.muted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(
    `Main = jumlah laga · M = menang · S = seri · K = kalah · GM/GK = gol memasukkan/kemasukan · SG = selisih gol   |   Poin ${pointsWin}/${pointsDraw}/${pointsLoss}`,
    PAD,
    y + 26,
  );
  const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  ctx.textAlign = 'right';
  ctx.fillText(`⚽ LeagueCup · ${stamp}`, WIDTH - PAD, y + 46);

  return canvas;
}

function fileName(league) {
  const slug = league.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'liga';
  return `klasemen-${slug}.png`;
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export async function downloadStandings(league) {
  const blob = await toBlob(renderStandings(league));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(league);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Share sheet (e.g. WhatsApp) where supported. Returns false if not. */
export async function shareStandings(league) {
  const blob = await toBlob(renderStandings(league));
  const file = new File([blob], fileName(league), { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: `Klasemen ${league.name}` });
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
  return true;
}

export function canShareFiles() {
  try {
    const f = new File([''], 'x.png', { type: 'image/png' });
    return Boolean(navigator.canShare?.({ files: [f] }));
  } catch {
    return false;
  }
}
