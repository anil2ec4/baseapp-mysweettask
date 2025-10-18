import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// GET /api/preferences?address=0x...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_address', address)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data || null });
}

// PUT /api/preferences  { address, filter, sort, active_tag }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, filter, sort, active_tag } = body;
    if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

    // ensure user exists (FK constraint)
    {
      const up = await supabase.from('users').upsert({ address }, { onConflict: 'address' });
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_address: address,
        filter,
        sort,
        active_tag,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_address' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 });
  }
}

