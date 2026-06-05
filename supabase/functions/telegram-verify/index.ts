// Openflou Telegram Bot - Full management: verify, login, recovery, admin support
// JWT is NOT verified here so Telegram webhook can POST without auth header
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const ADMIN_TELEGRAM_ID = 318088218; // Admin Telegram user ID

// Auto-setup webhook on every cold start
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? '';
const WEBHOOK_URL = `https://${projectRef}.backend.onspace.ai/functions/v1/telegram-verify`;

(async () => {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: WEBHOOK_URL, allowed_updates: ['message', 'callback_query'] }),
    });
    const d = await res.json();
    console.log('🤖 Auto webhook setup:', d.ok ? 'OK' : d.description);
  } catch (e) {
    console.error('Webhook auto-setup failed:', e);
  }
})();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // ====================================================
    // TELEGRAM WEBHOOK (incoming updates from Telegram)
    // ====================================================
    if (body.update_id !== undefined || body.message || body.callback_query) {

      // ---------- CALLBACK QUERY (admin inline buttons) ----------
      if (body.callback_query) {
        const cq = body.callback_query;
        const adminChatId = cq.from.id;
        const data = cq.data as string;

        // Only allow admin
        if (adminChatId !== ADMIN_TELEGRAM_ID) {
          await answerCallback(cq.id, '❌ Access denied');
          return ok();
        }

        // callback data format: "support_accept:<userId>" or "support_reject:<userId>"
        if (data.startsWith('support_accept:') || data.startsWith('support_reject:')) {
          const [action, userId] = data.split(':');
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('id', userId)
            .single();

          if (!user) {
            await answerCallback(cq.id, '❌ User not found');
            return ok();
          }

          if (action === 'support_accept') {
            // Mark relay active
            await supabase
              .from('openflou_users')
              .update({ admin_relay_active: true, support_request_pending: false })
              .eq('id', userId);

            await answerCallback(cq.id, '✅ Accepted');
            await sendMessage(
              ADMIN_TELEGRAM_ID,
              `✅ *Support session started*\n\nYou are now chatting with *${user.display_name}* (@${user.username})\n\nAll their Telegram messages will be forwarded to you.\nYou can reply to help them.\n\n_To grant password reset, use the hidden command._`
            );

            // Notify user
            if (user.telegram_chat_id) {
              await sendMessage(
                user.telegram_chat_id,
                `✅ *Your request was accepted!*\n\nAn administrator will help you recover your account.\nYou can now write your question or describe your problem — the admin will respond here.`
              );
            }
          } else {
            // Reject
            await supabase
              .from('openflou_users')
              .update({ support_request_pending: false, admin_relay_active: false })
              .eq('id', userId);

            await answerCallback(cq.id, '❌ Rejected');

            if (user.telegram_chat_id) {
              await sendMessage(
                user.telegram_chat_id,
                `❌ *Your recovery request was declined.*\n\nIf you believe this is a mistake, please contact support through official channels.`
              );
            }
          }
          return ok();
        }

        await answerCallback(cq.id, 'Unknown action');
        return ok();
      }

      // ---------- MESSAGE ----------
      if (body.message?.text) {
        const msg = body.message;
        const chatId = msg.chat.id;
        const fromId = msg.from.id;
        const telegramUsername = msg.from.username;
        const text = msg.text.trim();

        // ---- ADMIN messages ----
        if (fromId === ADMIN_TELEGRAM_ID) {

          // Hidden admin command: /grant_reset <userId>
          // Grants the user a password reset token without showing it to the user
          if (text.startsWith('/grant_reset ')) {
            const userId = text.split(' ')[1]?.trim();
            if (!userId) {
              await sendMessage(chatId, '❌ Usage: /grant_reset <userId>');
              return ok();
            }
            const { data: user } = await supabase
              .from('openflou_users')
              .select('*')
              .eq('id', userId)
              .single();
            if (!user) {
              await sendMessage(chatId, '❌ User not found');
              return ok();
            }
            const resetToken = generateCode() + generateCode(); // 12-char token
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await supabase
              .from('openflou_users')
              .update({
                password_reset_token: resetToken,
                password_reset_expires_at: expiresAt.toISOString(),
                admin_relay_active: false,
              })
              .eq('id', userId);
            // Send token directly to user via bot
            if (user.telegram_chat_id) {
              await sendMessage(
                user.telegram_chat_id,
                `🔑 *Password Reset Authorized*\n\nAn administrator has verified your identity.\n\nYour one-time reset code:\n\`${resetToken}\`\n\nGo to Openflou app → Login → *Forgot Password* → *I have a reset code* and enter this code.\n\n⏱ Valid for 24 hours`
              );
            }
            await sendMessage(chatId, `✅ Reset token sent to user *${user.display_name}* (@${user.username})\nToken: \`${resetToken}\` (visible to you only)`);
            return ok();
          }

          // /end_support <userId> — end relay session
          if (text.startsWith('/end_support ')) {
            const userId = text.split(' ')[1]?.trim();
            await supabase
              .from('openflou_users')
              .update({ admin_relay_active: false })
              .eq('id', userId);
            await sendMessage(chatId, '✅ Support session ended.');
            return ok();
          }

          // Admin is in relay mode — relay message to user
          const { data: relayUser } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('admin_relay_active', true)
            .limit(1)
            .single();

          if (relayUser?.telegram_chat_id) {
            await sendMessage(
              relayUser.telegram_chat_id,
              `💬 *Support:* ${text}`
            );
            await sendMessage(chatId, `✉️ Sent to *${relayUser.display_name}*`);
          } else {
            await sendMessage(chatId, 'ℹ️ No active support session. Use /grant_reset <userId> or wait for a support request.');
          }
          return ok();
        }

        // ---- USER messages ----

        // Check if this user is in relay mode (awaiting admin chat)
        const { data: relayCheck } = await supabase
          .from('openflou_users')
          .select('*')
          .eq('telegram_chat_id', chatId)
          .eq('admin_relay_active', true)
          .maybeSingle();

        if (relayCheck) {
          // Forward to admin
          await sendMessage(
            ADMIN_TELEGRAM_ID,
            `📩 *${relayCheck.display_name}* (@${relayCheck.username}) says:\n\n${text}\n\n_Reply here to respond. Use /end_support ${relayCheck.id} to close session._`
          );
          await sendMessage(chatId, '✉️ Your message has been forwarded to support. Please wait for a reply.');
          return ok();
        }

        // /start
        if (text.toLowerCase() === '/start') {
          await sendMessage(
            chatId,
            '👋 *Welcome to Openflou Bot!*\n\n' +
            '🔐 *Link Account:*\n' +
            '  Open Openflou → Settings → Privacy → Link Telegram\n\n' +
            '🔑 *Login:*\n' +
            '  Use /login to sign in (account must be linked)\n\n' +
            '🔒 *Recover Access:*\n' +
            '  Use /recover if you forgot your password\n\n' +
            '🗑️ *Delete Account:*\n' +
            '  Use /deleteaccount'
          );
          return ok();
        }

        // /login
        if (text.toLowerCase() === '/login') {
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .eq('telegram_verified', true)
            .single();

          if (!user) {
            await sendMessage(chatId,
              '❌ *No linked account.*\n\nLink your Telegram first:\nOpenflou → Settings → Privacy → Link Telegram'
            );
            return ok();
          }

          const loginToken = generateLoginToken();
          await supabase.from('openflou_users').update({
            telegram_verification_code: loginToken,
            telegram_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendMessage(chatId,
            `✅ *Login Code*\n\nAccount: *${user.display_name}* (@${user.username})\n\nCode: \`${loginToken}\`\n\nOpenflou → Login → *Login with Telegram*\n\n⏱ Valid 24 hours`
          );
          return ok();
        }

        // /recover — password recovery
        if (text.toLowerCase() === '/recover') {
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .eq('telegram_verified', true)
            .single();

          if (!user) {
            await sendMessage(chatId,
              '❌ *Account not linked.*\n\nThis Telegram account is not linked to any Openflou account.\n\nIf you cannot link because you forgot your password, use /support to contact admin.'
            );
            return ok();
          }

          // Generate password reset token
          const resetToken = generateCode() + generateCode();
          await supabase.from('openflou_users').update({
            password_reset_token: resetToken,
            password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendMessage(chatId,
            `🔑 *Password Reset*\n\nAccount: *${user.display_name}* (@${user.username})\n\nYour reset code:\n\`${resetToken}\`\n\nOpenflou app → Login → *Forgot Password* → *I have a reset code*\n\n⏱ Valid 30 minutes`
          );
          return ok();
        }

        // /support — request admin help (for users who can't recover)
        // Usage: /support @username_in_messenger
        if (text.toLowerCase().startsWith('/support')) {
          const parts = text.split(/\s+/);
          const messengerUsername = parts[1] || '';

          if (!messengerUsername) {
            await sendMessage(chatId,
              '❌ Please provide your messenger username.\n\nUsage: `/support @your_username`\n\nExample: `/support @john_doe`'
            );
            return ok();
          }

          // Try to find user by telegram_chat_id (if previously linked)
          let userDisplay = `Unknown user (Telegram ID: ${fromId})`;
          let userId = null;

          const { data: linkedUser } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .maybeSingle();

          if (linkedUser) {
            userDisplay = `*${linkedUser.display_name}* (@${linkedUser.username})`;
            userId = linkedUser.id;

            await supabase.from('openflou_users').update({
              support_request_pending: true,
              support_request_messenger: messengerUsername,
            }).eq('id', linkedUser.id);
          }

          // Notify admin with inline buttons
          const inlineKeyboard = userId
            ? {
                inline_keyboard: [[
                  { text: '✅ Accept', callback_data: `support_accept:${userId}` },
                  { text: '❌ Reject', callback_data: `support_reject:${userId}` },
                ]],
              }
            : undefined;

          await sendMessageWithKeyboard(
            ADMIN_TELEGRAM_ID,
            `🆘 *Account Recovery Request*\n\n` +
            `User: ${userDisplay}\n` +
            `Telegram: @${telegramUsername || 'N/A'} (ID: ${fromId})\n` +
            `Messenger: ${messengerUsername}\n` +
            `User ID: \`${userId || 'not linked'}\`\n\n` +
            `${userId ? 'Use buttons below to accept or reject.' : 'This user has no linked account. Verify manually.'}`,
            inlineKeyboard
          );

          await sendMessage(chatId,
            `✅ *Recovery request sent!*\n\nYour request has been forwarded to an administrator.\nThey will review it and contact you shortly via this bot.\n\nMessenger: ${messengerUsername}`
          );
          return ok();
        }

        // /deleteaccount
        if (text.toLowerCase() === '/deleteaccount') {
          const { data: user } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_chat_id', chatId)
            .eq('telegram_verified', true)
            .single();

          if (!user) {
            await sendMessage(chatId, '❌ No linked account found.');
            return ok();
          }

          const deleteCode = generateCode();
          await supabase.from('openflou_users').update({
            telegram_verification_code: `DELETE_${deleteCode}`,
            telegram_code_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendMessage(chatId,
            `⚠️ *Delete Account Confirmation*\n\nAccount: *${user.display_name}* (@${user.username})\n\n` +
            `❗ This will permanently delete all your data.\n\nConfirm with: \`${deleteCode}\`\n\n⏱ Valid 5 minutes`
          );
          return ok();
        }

        // Verification code (6 chars)
        if (/^[A-Z0-9]{6}$/i.test(text) && text.length === 6) {
          const upperText = text.toUpperCase();
          const { data: users } = await supabase
            .from('openflou_users')
            .select('*')
            .eq('telegram_verification_code', upperText)
            .is('telegram_verified', false);

          if (users && users.length > 0) {
            const user = users[0];
            if (new Date() > new Date(user.telegram_code_expires_at)) {
              await sendMessage(chatId, '❌ Code expired. Generate a new one in the app.');
              return ok();
            }
            if (user.telegram_username && user.telegram_username.toLowerCase() !== telegramUsername?.toLowerCase()) {
              await sendMessage(chatId, `❌ Username mismatch! Code is for @${user.telegram_username}`);
              return ok();
            }
            await supabase.from('openflou_users').update({
              telegram_verified: true,
              telegram_chat_id: chatId,
              telegram_username: telegramUsername,
              telegram_verification_code: null,
              telegram_code_expires_at: null,
            }).eq('id', user.id);

            await sendMessage(chatId,
              `✅ *Account Linked!*\n\n@${telegramUsername} is now linked to *${user.display_name}* (@${user.username})\n\n` +
              `Commands:\n/login — sign in\n/recover — reset password\n/support — contact admin`
            );
            return ok();
          }
        }

        // Delete confirmation code
        const upperText = text.toUpperCase();
        const { data: deleteUsers } = await supabase
          .from('openflou_users')
          .select('*')
          .eq('telegram_verification_code', `DELETE_${upperText}`)
          .eq('telegram_chat_id', chatId);

        if (deleteUsers && deleteUsers.length > 0) {
          const user = deleteUsers[0];
          if (new Date() > new Date(user.telegram_code_expires_at)) {
            await sendMessage(chatId, '❌ Deletion code expired.');
            return ok();
          }
          await supabase.from('openflou_messages').delete().eq('sender_id', user.id);
          await supabase.from('openflou_contacts').delete().eq('user_id', user.id);
          await supabase.from('openflou_sessions').delete().eq('user_id', user.id);
          const { data: userChats } = await supabase.from('openflou_chats').select('*').contains('participants', [user.id]);
          for (const chat of userChats || []) {
            if (chat.participants.length === 1) {
              await supabase.from('openflou_chats').delete().eq('id', chat.id);
            } else {
              await supabase.from('openflou_chats').update({
                participants: chat.participants.filter((p: string) => p !== user.id),
              }).eq('id', chat.id);
            }
          }
          await supabase.from('openflou_users').delete().eq('id', user.id);
          await sendMessage(chatId, `✅ *Account Deleted*\n\n*${user.display_name}* has been permanently removed. Thank you for using Openflou! 👋`);
          return ok();
        }

        // Unknown
        await sendMessage(chatId, 'ℹ️ Unknown command.\n\nUse /start to see available commands.');
      }
      return ok();
    }

    // ====================================================
    // APP API (called from mobile app)
    // ====================================================
    const { action, userId, telegramUsername, loginToken, resetToken, newPassword } = body;

    // Request Telegram reset — send /recover-style code via bot to linked account
    if (action === 'request_tg_reset') {
      const { username } = body;
      const { data: user } = await supabase
        .from('openflou_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (!user) return json({ error: 'Account not found' }, 404);
      if (!user.telegram_verified || !user.telegram_chat_id) {
        return json({ error: 'No Telegram account linked to this username. Use admin support instead.' }, 400);
      }
      const resetToken = generateCode() + generateCode();
      await supabase.from('openflou_users').update({
        password_reset_token: resetToken,
        password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).eq('id', user.id);
      await sendMessage(
        user.telegram_chat_id,
        `🔑 *Password Reset Requested*\n\nAccount: *${user.display_name}* (@${user.username})\n\nReset code:\n\`${resetToken}\`\n\nOpenflou → Login → *Forgot Password* → *I have a reset code*\n\n⏱ Valid 30 minutes`
      );
      return json({ sent: true });
    }

    // Generate verification code
    if (action === 'generate') {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const { error } = await supabase.from('openflou_users').update({
        telegram_username: telegramUsername?.toLowerCase(),
        telegram_verification_code: code,
        telegram_code_expires_at: expiresAt.toISOString(),
        telegram_verified: false,
      }).eq('id', userId);
      if (error) throw error;
      return json({ code });
    }

    // Check verification status
    if (action === 'check') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('telegram_verified, telegram_username')
        .eq('id', userId)
        .single();
      return json({ verified: user?.telegram_verified || false, username: user?.telegram_username });
    }

    // Telegram login with token
    if (action === 'telegram_login') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('*')
        .eq('telegram_verification_code', loginToken)
        .eq('telegram_verified', true)
        .single();
      if (!user) return json({ error: 'Invalid or expired login token' }, 401);
      if (new Date() > new Date(user.telegram_code_expires_at)) return json({ error: 'Login token expired' }, 401);
      await supabase.from('openflou_users').update({
        telegram_verification_code: null,
        telegram_code_expires_at: null,
        is_online: true,
        last_seen: new Date().toISOString(),
      }).eq('id', user.id);
      return json({ user });
    }

    // Validate reset token (check if valid before showing reset form)
    if (action === 'validate_reset_token') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('id, username, display_name, password_reset_token, password_reset_expires_at')
        .eq('password_reset_token', resetToken)
        .single();
      if (!user) return json({ valid: false, error: 'Invalid reset token' });
      if (new Date() > new Date(user.password_reset_expires_at)) return json({ valid: false, error: 'Reset token expired' });
      return json({ valid: true, username: user.username, displayName: user.display_name, userId: user.id });
    }

    // Apply password reset
    if (action === 'reset_password') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('id, password_reset_token, password_reset_expires_at')
        .eq('password_reset_token', resetToken)
        .single();
      if (!user) return json({ error: 'Invalid reset token' }, 400);
      if (new Date() > new Date(user.password_reset_expires_at)) return json({ error: 'Reset token expired' }, 400);

      // Hash new password using same method as openflou-auth
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword + 'openflou_salt_2024');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      await supabase.from('openflou_users').update({
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires_at: null,
      }).eq('id', user.id);
      return json({ success: true });
    }

    // Unlink Telegram
    if (action === 'unlink') {
      await supabase.from('openflou_users').update({
        telegram_username: null,
        telegram_verified: false,
        telegram_chat_id: null,
        telegram_verification_code: null,
        telegram_code_expires_at: null,
      }).eq('id', userId);
      return json({ success: true });
    }

    // Setup webhook manually (still available as fallback)
    if (action === 'setup_webhook') {
      const result = await fetch(`${TELEGRAM_API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: WEBHOOK_URL, allowed_updates: ['message', 'callback_query'] }),
      });
      const data = await result.json();
      return json(data);
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('❌ telegram-verify error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ====================================================
// HELPERS
// ====================================================

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateLoginToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    const result = await r.json();
    if (!result.ok) console.error('❌ sendMessage error:', result.description);
  } catch (e) {
    console.error('❌ sendMessage exception:', e);
  }
}

async function sendMessageWithKeyboard(chatId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });
    const result = await r.json();
    if (!result.ok) console.error('❌ sendMessageWithKeyboard error:', result.description);
  } catch (e) {
    console.error('❌ sendMessageWithKeyboard exception:', e);
  }
}

async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (e) {
    console.error('❌ answerCallback exception:', e);
  }
}
