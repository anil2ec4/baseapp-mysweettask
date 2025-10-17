import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the webhook for debugging
    console.log('Webhook received:', JSON.stringify(body, null, 2));
    
    // Handle different webhook types
    switch (body.type) {
      case 'user.connected':
        await handleUserConnected(body);
        break;
      case 'user.disconnected':
        await handleUserDisconnected(body);
        break;
      case 'task.created':
        await handleTaskCreated(body);
        break;
      case 'task.updated':
        await handleTaskUpdated(body);
        break;
      case 'task.completed':
        await handleTaskCompleted(body);
        break;
      default:
        console.log('Unknown webhook type:', body.type);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleUserConnected(data: any) {
  const { fid, username, displayName, pfpUrl, bio } = data;
  
  // Create or update user in database
  const { error } = await supabase
    .from('users')
    .upsert({
      fid,
      username,
      display_name: displayName,
      pfp_url: pfpUrl,
      bio,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'fid'
    });
    
  if (error) {
    console.error('Error creating user:', error);
  }
}

async function handleUserDisconnected(data: any) {
  const { fid } = data;
  
  // You might want to mark user as inactive or handle disconnection
  console.log('User disconnected:', fid);
}

async function handleTaskCreated(data: any) {
  const { taskId, userId, title, description } = data;
  
  // Create notification for task creation
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'task_created',
      title: 'New Task Created',
      message: `Task "${title}" has been created`,
      data: { taskId, title }
    });
}

async function handleTaskUpdated(data: any) {
  const { taskId, userId, title, changes } = data;
  
  // Create notification for task update
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'task_updated',
      title: 'Task Updated',
      message: `Task "${title}" has been updated`,
      data: { taskId, title, changes }
    });
}

async function handleTaskCompleted(data: any) {
  const { taskId, userId, title } = data;
  
  // Create notification for task completion
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'task_completed',
      title: 'Task Completed',
      message: `Task "${title}" has been completed`,
      data: { taskId, title }
    });
}
