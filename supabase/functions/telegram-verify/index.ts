// Openflou Telegram Verification Edge Function
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

    const { action, userId, telegramUsername, verificationCode } = await req.json();

    // Generate verification code
    if (action === 'generate') {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const { error } = await supabase
        .from('openflou_users')
        .update({
          telegram_username: telegramUsername,
          telegram_verification_code: code,
          telegram_code_expires_at: expiresAt.toISOString(),
          telegram_verified: false,
        })
        .eq('id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify code
    if (action === 'verify') {
      const { data: user, error } = await supabase
        .from('openflou_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if code matches and not expired
      const now = new Date();
      const expiresAt = new Date(user.telegram_code_expires_at);

      if (user.telegram_verification_code !== verificationCode) {
        return new Response(
          JSON.stringify({ error: 'Invalid verification code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (now > expiresAt) {
        return new Response(
          JSON.stringify({ error: 'Verification code expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as verified
      await supabase
        .from('openflou_users')
        .update({
          telegram_verified: true,
          telegram_verification_code: null,
          telegram_code_expires_at: null,
        })
        .eq('id', userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unlink Telegram
    if (action === 'unlink') {
      await supabase
        .from('openflou_users')
        .update({
          telegram_username: null,
          telegram_verified: false,
          telegram_verification_code: null,
          telegram_code_expires_at: null,
        })
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
    console.error('Telegram verify error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
