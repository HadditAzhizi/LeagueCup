import { handle, health } from '@/lib/server/service';

export const dynamic = 'force-dynamic';

export const GET = handle(() => health());
