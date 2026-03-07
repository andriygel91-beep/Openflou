// Openflou Telegram Bot Integration - Full account management
// Handles: verification, login, account deletion
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

    const body = await req.json();

    // ==================== TELEGRAM WEBHOOK ====================
    if (req.method === 'POST' && (body.message || body.update_id)) {
      const update = body;
      console.log('📨 Telegram webhook:', JSON.stringify(update));

      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const telegramUsername = update.message.from.username;
        const text = update.message.text.trim();

        // Handle /start command
        if (text.toLowerCase() === '/start') {
          await sendTelegramMessage(
            chatId,
            '👋 *Welcome to Openflou Bot!*\n\n' +
            '🔐 *Link Account:*\n' +
            '1. Open Openflou app → Settings → Privacy → Link Telegram\n' +
            '2. Generate code and send it here\n\n' +
            '🔑 *Login:*\n' +
            'If your account is already linked, use /login to sign in\n\n' +
            '🗑️ *Delete Account:*\n' +
            'Use /deleteaccount to permanently remove your Openflou account'
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Handle /login command
        if (text.toLowerCase() === '/login') {
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .eq('telegram_verified', true)
            .single();

          if (!user) {
            await sendTelegramMessage(
              chatId,
              '❌ *No linked account found.*\n\n' +
              'Please link your Telegram account first:\n' +
              '1. Open Openflou app\n' +
              '2. Settings → Privacy → Link Telegram\n' +
              '3. Follow the instructions'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Generate login token (24-hour expiry)
          const loginToken = generateLoginToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          await supabase
            .from('openflou_users')
            .update({
              telegram_verification_code: loginToken,
              telegram_code_expires_at: expiresAt.toISOString(),
            })
            .eq('id', user.id);

          await sendTelegramMessage(
            chatId,
            `✅ *Login Code Generated*\n\n` +
            `Account: *${user.display_name}* (@${user.username})\n\n` +
            `Login code: \`${loginToken}\`\n\n` +
            `Open Openflou app → Login → "Login with Telegram" and enter this code.\n\n` +
            `⏱ Valid for 24 hours`
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Handle /deleteaccount command
        if (text.toLowerCase() === '/deleteaccount') {
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .eq('telegram_verified', true)
            .single();

          if (!user) {
            await sendTelegramMessage(
              chatId,
              '❌ No linked account found.'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Generate deletion confirmation code
          const deleteCode = generateCode();
          await supabase
            .from('openflou_users')
            .update({
              telegram_verification_code: `DELETE_${deleteCode}`,
              telegram_code_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            })
            .eq('id', user.id);

          await sendTelegramMessage(
            chatId,
            `⚠️ *Account Deletion Confirmation*\n\n` +
            `Account: *${user.display_name}* (@${user.username})\n\n` +
            `❗️ This will permanently delete:\n` +
            `• Your profile and messages\n` +
            `• All chats and contacts\n` +
            `• This action cannot be undone!\n\n` +
            `To confirm deletion, reply with: \`${deleteCode}\`\n\n` +
            `⏱ Code expires in 5 minutes`
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if message is a verification/login/delete code
        const upperText = text.toUpperCase();
        
        // Handle verification code (6 chars)
        if (/^[A-Z0-9]{6}$/.test(upperText)) {
          const { data: users } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_verification_code', upperText)
            .is('telegram_verified', false);

          if (!users || users.length === 0) {
            await sendTelegramMessage(
              chatId,
              '❌ Invalid or expired code.\n\n' +
              'Please generate a new code in the Openflou app.'
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const user = users[0];

          // Check expiry
          if (new Date() > new Date(user.telegram_code_expires_at)) {
            await sendTelegramMessage(chatId, '❌ Code expired. Please generate a new one.');
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Verify username match
          if (user.telegram_username && user.telegram_username.toLowerCase() !== telegramUsername?.toLowerCase()) {
            await sendTelegramMessage(
              chatId,
              `❌ Username mismatch!\n\n` +
              `This code is for @${user.telegram_username}`
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // SUCCESS - Link account
          await supabase
            .from('openflou_users')
            .update({
              telegram_verified: true,
              telegram_chat_id: chatId,
              telegram_username: telegramUsername,
              telegram_verification_code: null,
              telegram_code_expires_at: null,
            })
            .eq('id', user.id);

          await sendTelegramMessage(
            chatId,
            `✅ *Account Linked Successfully!*\n\n` +
            `Your Telegram (@${telegramUsername}) is now linked to Openflou account *${user.display_name}* (@${user.username})\n\n` +
            `You can now:\n` +
            `• Use /login to sign in\n` +
            `• Recover your account if you forget password`
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if it's a deletion confirmation code
        const { data: deleteUsers } = await supabase
          .from('openflou_users')
          .select('*')
          .eq('telegram_verification_code', `DELETE_${upperText}`)
          .eq('telegram_chat_id', chatId);

        if (deleteUsers && deleteUsers.length > 0) {
          const user = deleteUsers[0];

          // Check expiry
          if (new Date() > new Date(user.telegram_code_expires_at)) {
            await sendTelegramMessage(chatId, '❌ Deletion code expired.');
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Delete all user data
          await supabase.from('openflou_messages').delete().eq('sender_id', user.id);
          await supabase.from('openflou_contacts').delete().eq('user_id', user.id);
          await supabase.from('openflou_sessions').delete().eq('user_id', user.id);
          
          // Delete chats where user is the only participant
          const { data: userChats } = await supabase
            .from('openflou_chats')
            .select('*')
            .contains('participants', [user.id]);
          
          for (const chat of userChats || []) {
            if (chat.participants.length === 1) {
              await supabase.from('openflou_chats').delete().eq('id', chat.id);
            } else {
              // Remove user from participants
              const newParticipants = chat.participants.filter((p: string) => p !== user.id);
              await supabase
                .from('openflou_chats')
                .update({ participants: newParticipants })
                .eq('id', chat.id);
            }
          }

          // Finally delete user
          await supabase.from('openflou_users').delete().eq('id', user.id);

          await sendTelegramMessage(
            chatId,
            `✅ *Account Deleted*\n\n` +
            `Your Openflou account *${user.display_name}* has been permanently deleted.\n\n` +
            `All your data has been removed from our servers.\n\n` +
            `Thank you for using Openflou! 👋`
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Unknown message
        await sendTelegramMessage(
          chatId,
          'ℹ️ Unknown command.\n\n' +
          'Use /start to see available commands.'
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== APP API ====================
    const { action, userId, telegramUsername, loginToken } = body;

    // Generate verification code
    if (action === 'generate') {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { error } = await supabase
        .from('openflou_users')
        .update({
          telegram_username: telegramUsername?.toLowerCase(),
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

    // Check verification status
    if (action === 'check') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('telegram_verified, telegram_username')
        .eq('id', userId)
        .single();

      return new Response(
        JSON.stringify({
          verified: user?.telegram_verified || false,
          username: user?.telegram_username,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Login with Telegram token
    if (action === 'telegram_login') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('*')
        .eq('telegram_verification_code', loginToken)
        .eq('telegram_verified', true)
        .single();

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired login token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiry
      if (new Date() > new Date(user.telegram_code_expires_at)) {
        return new Response(
          JSON.stringify({ error: 'Login token expired' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clear token and update status
      await supabase
        .from('openflou_users')
        .update({
          telegram_verification_code: null,
          telegram_code_expires_at: null,
          is_online: true,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ user }),
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
          telegram_chat_id: null,
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

function generateLoginToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
    }
  } catch (error) {
    console.error('❌ Send message error:', error);
  }
}
