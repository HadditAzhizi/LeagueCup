import { handle, getCupDetail, updateCup, deleteCup } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const GET = handle(({ params }) => getCupDetail(params.id));
export const PUT = handle(({ params, body }) => updateCup(params.id, body));
export const DELETE = handle(({ params }) => deleteCup(params.id));
