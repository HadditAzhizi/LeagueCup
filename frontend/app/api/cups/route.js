import { handle, listCups, createCup } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const GET = handle(() => listCups());
export const POST = handle(({ body }) => createCup(body));
