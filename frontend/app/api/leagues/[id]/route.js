import { handle, getLeagueDetail, updateLeague, deleteLeague } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const GET = handle(({ params }) => getLeagueDetail(params.id));
export const PUT = handle(({ params, body }) => updateLeague(params.id, body));
export const DELETE = handle(({ params }) => deleteLeague(params.id));
