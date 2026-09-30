import { handle, saveLeagueMatch } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const PUT = handle(({ params, body }) => saveLeagueMatch(params.id, params.matchId, body));
