// Openflou Telegram Bot Integration
// Handles verification via real Telegram bot
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

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

    const url = new URL(req.url);
    const path = url.pathname;

    // ==================== TELEGRAM WEBHOOK ====================
    // Receives messages from Telegram bot
    if (req.method === 'POST' && !url.searchParams.get('action')) {
      const update = await req.json();
      console.log('📨 Telegram webhook update:', JSON.stringify(update));

      // Handle incoming message
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const telegramUsername = update.message.from.username;
        const text = update.message.text.trim().toUpperCase();

        // Handle /start command
        if (text === '/START') {
          await sendTelegramMessage(
            chatId,
            '👋 Welcome to Openflou Bot!\n\n' +
            'To link your Telegram account:\n' +
            '1. Open Openflou app\n' +
            '2. Go to Settings → Privacy → Link Telegram\n' +
            '3. Enter your Telegram username and generate code\n' +
            '4. Send that code here\n\n' +
            'Example: ABC123'
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if message is a verification code (6 characters, alphanumeric)
        if (/^[A-Z0-9]{6}$/.test(text)) {
          console.log('🔍 Checking verification code:', text);

          // Find user with this code
          const { data: users, error } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_verification_code', text)
            .is('telegram_verified', false);

          if (error) {
            console.error('❌ Database error:', error);
            await sendTelegramMessage(
              chatId,
              '❌ Verification failed. Please try again.'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (!users || users.length === 0) {
            console.log('⚠️ No user found with code:', text);
            await sendTelegramMessage(
              chatId,
              '❌ Invalid or expired code.\n\n' +
              'Please:\n' +
              '1. Generate a new code in Openflou app\n' +
              '2. Make sure you enter your correct Telegram username\n' +
              '3. Send the code within 5 minutes'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const user = users[0];

          // Check if code expired
          const expiresAt = new Date(user.telegram_code_expires_at);
          const now = new Date();

          if (now > expiresAt) {
            console.log('⏰ Code expired for user:', user.id);
            await sendTelegramMessage(
              chatId,
              '❌ This code has expired.\n\n' +
              'Please generate a new code in the Openflou app.'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Verify that Telegram username matches
          if (user.telegram_username && user.telegram_username !== telegramUsername) {
            console.log('⚠️ Username mismatch:', user.telegram_username, 'vs', telegramUsername);
            await sendTelegramMessage(
              chatId,
              `❌ Username mismatch!\n\n` +
              `This code was generated for @${user.telegram_username}\n` +
              `But you are @${telegramUsername}\n\n` +
              `Please use the correct Telegram account.`
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // SUCCESS! Mark as verified
          console.log('✅ Verifying user:', user.id);
          await supabase
            .from('openflou_users')
            .update({
              telegram_verified: true,
              telegram_verification_code: null,
              telegram_code_expires_at: null,
            })
            .eq('id', user.id);

          await sendTelegramMessage(
            chatId,
            '✅ Success!\n\n' +
            `Your Telegram account (@${telegramUsername}) is now linked to Openflou.\n\n` +
            'You can use this for account recovery and security.'
          );

          console.log('✅ User verified successfully');
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Unknown message
        await sendTelegramMessage(
          chatId,
          'ℹ️ Please send a valid 6-character verification code.\n\n' +
          'If you do not have a code yet:\n' +
          '1. Open Openflou app\n' +
          '2. Go to Settings → Privacy → Link Telegram\n' +
          '3. Generate code and send it here'
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== APP API ====================
    const { action, userId, telegramUsername, verificationCode } = await req.json();

    // Generate verification code
    if (action === 'generate') {
      const code = generateCode();
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

      if (error) {
        console.error('❌ Generate code error:', error);
        throw error;
      }

      console.log('✅ Code generated:', code, 'for user:', userId);
      return new Response(
        JSON.stringify({ code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check verification status
    if (action === 'check') {
      const { data: user, error } = await supabase
        .from('openflou_users')
        .select('telegram_verified, telegram_username')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return new Response(
          JSON.stringify({ verified: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          verified: user.telegram_verified,
          username: user.telegram_username,
        }),
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
    console.error('❌ Telegram verify error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== HELPERS ====================

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Telegram API error:', result);
    } else {
      console.log('✅ Message sent to', chatId);
    }
  } catch (error) {
    console.error('❌ Send message error:', error);
  }
}
