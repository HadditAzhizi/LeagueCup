export function roundName(matchesInRound) {
  switch (matchesInRound) {
    case 1: return 'Final';
    case 2: return 'Semifinal';
    case 4: return 'Perempat Final';
    default: return `Babak ${matchesInRound * 2} Besar`;
  }
}

/**
 * Build a full single-elimination bracket. The bracket size is the next
 * power of two; extra slots become byes spread evenly through round 1, so
 * no match is ever bye-vs-bye.
 */
export function generateCupBracket(teams) {
  let size = 2;
  while (size < teams.length) size *= 2;
  const firstRoundMatches = size / 2;
  const byes = size - teams.length;

  const byeSlots = new Set();
  for (let k = 0; k < byes; k++) byeSlots.add(Math.floor((k * firstRoundMatches) / byes));

  const queue = teams.map((t) => t.id);
  const rounds = [];
  const first = [];
  for (let i = 0; i < firstRoundMatches; i++) {
    const homeId = queue.shift();
    const awayId = byeSlots.has(i) ? null : queue.shift();
    first.push(newMatch(homeId, awayId, byeSlots.has(i)));
  }
  rounds.push({ name: roundName(first.length), matches: first });

  for (let count = firstRoundMatches / 2; count >= 1; count /= 2) {
    const matches = Array.from({ length: count }, () => newMatch(null, null, false));
    rounds.push({ name: roundName(count), matches });
  }

  propagate(rounds);
  return rounds;
}

function newMatch(homeId, awayId, bye) {
  return {
    id: crypto.randomUUID(),
    homeId: homeId ?? null,
    awayId: awayId ?? null,
    bye,
    homeScore: null,
    awayScore: null,
    homePens: null,
    awayPens: null,
    winnerId: bye ? homeId : null,
    played: false,
  };
}

function clearResult(m) {
  m.homeScore = m.awayScore = m.homePens = m.awayPens = null;
  m.winnerId = null;
  m.played = false;
}

/** Winner from a score line, or null if still undecided (draw w/o penalties). */
export function decideWinner(m) {
  if (m.homeScore > m.awayScore) return m.homeId;
  if (m.awayScore > m.homeScore) return m.awayId;
  if (m.homePens == null || m.awayPens == null || m.homePens === m.awayPens) return null;
  return m.homePens > m.awayPens ? m.homeId : m.awayId;
}

/**
 * Push winners forward through the bracket. If an earlier result changes
 * which team reaches a later match, that later match's result is cleared.
 */
export function propagate(rounds) {
  for (let r = 1; r < rounds.length; r++) {
    const prev = rounds[r - 1].matches;
    rounds[r].matches.forEach((m, i) => {
      const homeId = prev[2 * i].winnerId ?? null;
      const awayId = prev[2 * i + 1].winnerId ?? null;
      if (m.homeId !== homeId || m.awayId !== awayId) {
        m.homeId = homeId;
        m.awayId = awayId;
        clearResult(m);
      }
    });
  }
}

export function findMatch(cup, matchId) {
  for (const round of cup.rounds) {
    const m = round.matches.find((x) => x.id === matchId);
    if (m) return m;
  }
  return null;
}

export function champion(cup) {
  const final = cup.rounds.at(-1)?.matches[0];
  return final?.winnerId ?? null;
}

export { clearResult };
