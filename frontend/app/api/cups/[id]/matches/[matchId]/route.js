import { handle, saveCupMatch } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const PUT = handle(({ params, body }) => saveCupMatch(params.id, params.matchId, body));
