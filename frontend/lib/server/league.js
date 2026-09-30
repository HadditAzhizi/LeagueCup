/**
 * Round-robin fixtures using the circle method.
 * With an odd number of teams, one team rests each round.
 */
export function generateLeagueFixtures(teams, doubleRoundRobin) {
  const ids = teams.map((t) => t.id);
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds = n - 1;
  const matches = [];

  let rotation = ids.slice();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === null || b === null) continue;
      // Alternate home/away so the fixed team doesn't always play at home.
      const [homeId, awayId] = (r + i) % 2 === 0 ? [a, b] : [b, a];
      matches.push(newMatch(r + 1, homeId, awayId));
    }
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }

  if (doubleRoundRobin) {
    const firstLeg = matches.slice();
    for (const m of firstLeg) {
      matches.push(newMatch(m.round + rounds, m.awayId, m.homeId));
    }
  }
  return matches;
}

function newMatch(round, homeId, awayId) {
  return { id: crypto.randomUUID(), round, homeId, awayId, homeScore: null, awayScore: null, played: false };
}

export function computeStandings(league) {
  const { pointsWin, pointsDraw, pointsLoss } = league.settings;
  const rows = new Map(
    league.teams.map((t) => [
      t.id,
      { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] },
    ]),
  );

  const played = league.matches.filter((m) => m.played).sort((a, b) => a.round - b.round);
  for (const m of played) {
    const home = rows.get(m.homeId);
    const away = rows.get(m.awayId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won++; away.lost++;
      home.points += pointsWin; away.points += pointsLoss;
      home.form.push('W'); away.form.push('L');
    } else if (m.homeScore < m.awayScore) {
      away.won++; home.lost++;
      away.points += pointsWin; home.points += pointsLoss;
      away.form.push('W'); home.form.push('L');
    } else {
      home.drawn++; away.drawn++;
      home.points += pointsDraw; away.points += pointsDraw;
      home.form.push('D'); away.form.push('D');
    }
  }

  const table = [...rows.values()];
  for (const r of table) {
    r.gd = r.gf - r.ga;
    r.form = r.form.slice(-5);
  }
  table.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || b.won - a.won || a.name.localeCompare(b.name),
  );
  return table.map((r, i) => ({ position: i + 1, ...r }));
}
