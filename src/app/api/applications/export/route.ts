import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';

// Streams the signed-in user's applications as a JSON download. RLS scopes the
// query to the current user automatically.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), count: data?.length ?? 0, applications: data },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="applications-${todayISO()}.json"`,
    },
  });
}
