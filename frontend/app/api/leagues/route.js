import { handle, listLeagues, createLeague } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const GET = handle(() => listLeagues());
export const POST = handle(({ body }) => createLeague(body));
