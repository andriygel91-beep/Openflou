// Openflou Authentication Edge Function - ID-based auth with display names
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, username, displayName, password, userId, telegramChatId } = await req.json();

    // Sign Up
    if (action === 'signup') {
      // Check if username exists (case-insensitive)
      const { data: existingUser } = await supabase
        .from('openflou_users')
        .select('id')
        .ilike('username', username)
        .single();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Username already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create user (username will be auto-lowercased by trigger)
      const { data: newUser, error } = await supabase
        .from('openflou_users')
        .insert({
          username: username.toLowerCase(), // Explicit lowercase
          display_name: displayName || username,
          password_hash: password, // In production, use bcrypt
          is_online: true,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ user: newUser }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sign In (by username + password)
    if (action === 'signin') {
      const { data: user, error } = await supabase
        .from('openflou_users')
        .select('*')
        .ilike('username', username)
        .eq('password_hash', password)
        .single();

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update online status
      await supabase
        .from('openflou_users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ user }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sign In via Telegram (by telegram_chat_id)
    if (action === 'telegram_signin') {
      const { data: user, error } = await supabase
        .from('openflou_users')
        .select('*')
        .eq('telegram_chat_id', telegramChatId)
        .eq('telegram_verified', true)
        .single();

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'No verified Telegram account found' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update online status
      await supabase
        .from('openflou_users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ user }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update Online Status
    if (action === 'updateStatus') {
      await supabase
        .from('openflou_users')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
