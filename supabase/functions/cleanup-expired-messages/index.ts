// Openflou - Auto-delete expired messages (Disappearing Messages)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    console.log('🧹 Starting cleanup of expired messages...');

    // Delete all messages where expires_at is in the past
    const { data, error } = await supabase
      .from('openflou_messages')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('❌ Cleanup error:', error);
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`✅ Deleted ${deletedCount} expired messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        timestamp: new Date().toISOString() 
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('💥 Cleanup exception:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
