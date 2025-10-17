import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// POST /api/tasks/bulk  { address, tasks: Task[] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, tasks } = body;
    if (!address || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'address and tasks required' }, { status: 400 });
    }

    // ensure user exists (upsert minimal)
    await supabase.from('users').upsert({ address }, { onConflict: 'address' });

    // replace strategy: delete all then insert
    const del = await supabase.from('tasks').delete().eq('user_address', address);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

    if (tasks.length > 0) {
      const rows = tasks.map((t: any) => ({
        id: String(t.id),
        user_address: address,
        text: t.text,
        completed: !!t.completed,
        priority: t.priority ?? 'medium',
        due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
        tags: Array.isArray(t.tags) ? t.tags : [],
        pomodoros: typeof t.pomodoros === 'number' ? t.pomodoros : 0,
        completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
        pomodoro_paused_at: typeof t.pomodoroPausedAt === 'number' ? t.pomodoroPausedAt : null,
      }));
      const ins = await supabase.from('tasks').insert(rows);
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 });
  }
}

