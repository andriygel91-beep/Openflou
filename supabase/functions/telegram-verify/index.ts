// Openflou Telegram Bot — Full management: verify, login, recovery, admin support
// OnSpace Cloud Edge Functions bypass JWT for requests containing the correct secret_token
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const ADMIN_TELEGRAM_ID = 318088218;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// Extract project ref from URL: https://<ref>.supabase.co or https://<ref>.backend.onspace.ai
const projectRef = SUPABASE_URL
  .replace('https://', '')
  .replace('.supabase.co', '')
  .replace('.backend.onspace.ai', '')
  .split('.')[0];

// Secret token: simple alphanumeric string Telegram will send in X-Telegram-Bot-Api-Secret-Token header
const BOT_SECRET = 'openflou' + (TELEGRAM_BOT_TOKEN.split(':')[0] || '123');

// Webhook URL — using the hardcoded backend URL for reliability
const FUNCTION_BASE_URL = 'https://lrfezdyyybayejnblrfe.backend.onspace.ai/functions/v1/telegram-verify';
const WEBHOOK_URL = `${FUNCTION_BASE_URL}?secret=${BOT_SECRET}`;

// ── Auto-register webhook on cold start ──
let webhookRegistered = false;
(async () => {
  if (!TELEGRAM_BOT_TOKEN || webhookRegistered) return;
  webhookRegistered = true;
  try {
    // Check current webhook
    const infoRes = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
    const info = await infoRes.json();
    const currentUrl: string = info?.result?.url ?? '';

    if (currentUrl === WEBHOOK_URL) {
      console.log('✅ Webhook already correct:', WEBHOOK_URL);
      return;
    }

    console.log('🔧 Registering webhook. Current:', currentUrl || '(none)');
    const setRes = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query'],
        secret_token: BOT_SECRET,
        drop_pending_updates: false,
        max_connections: 40,
      }),
    });
    const setData = await setRes.json();
    console.log('🔧 Webhook register result:', JSON.stringify(setData));
  } catch (e) {
    console.error('❌ Webhook auto-setup failed:', e);
  }
})();

// ── Main handler ──
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if this is a Telegram webhook request by secret token
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const isTelegramWebhook = secretParam === BOT_SECRET || secretHeader === BOT_SECRET;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ================================================================
    // TELEGRAM WEBHOOK — incoming updates from Telegram servers
    // ================================================================
    if (isTelegramWebhook && (body.update_id !== undefined || body.message || body.callback_query)) {

      // ── Callback query (admin inline buttons) ──
      if (body.callback_query) {
        const cq = body.callback_query;
        const fromId: number = cq.from.id;
        const cbData: string = cq.data ?? '';

        if (fromId !== ADMIN_TELEGRAM_ID) {
          await answerCallback(cq.id, '❌ Access denied');
          return ok();
        }

        if (cbData.startsWith('support_accept:') || cbData.startsWith('support_reject:')) {
          const [action, userId] = cbData.split(':');
          const { data: user } = await supabase
            .from('openflou_users').select('*').eq('id', userId).single();

          if (!user) { await answerCallback(cq.id, '❌ User not found'); return ok(); }

          if (action === 'support_accept') {
            await supabase.from('openflou_users')
              .update({ admin_relay_active: true, support_request_pending: false })
              .eq('id', userId);

            await answerCallback(cq.id, '✅ Accepted');
            await sendTGMessage(ADMIN_TELEGRAM_ID,
              `✅ *Support session started*\n\nChatting with *${user.display_name}* (@${user.username})\n\nAll their messages will be forwarded here. Reply to respond.\n\nGrant reset: /grant_reset ${userId}\nEnd session: /end_support ${userId}`);

            if (user.telegram_chat_id) {
              await sendTGMessage(user.telegram_chat_id,
                `✅ *Your request was accepted!*\n\nAn administrator will help you. Write your question here and the admin will respond.`);
            }
          } else {
            await supabase.from('openflou_users')
              .update({ support_request_pending: false, admin_relay_active: false })
              .eq('id', userId);

            await answerCallback(cq.id, '❌ Rejected');
            if (user.telegram_chat_id) {
              await sendTGMessage(user.telegram_chat_id,
                `❌ *Your recovery request was declined.*\n\nContact support through official channels if you believe this is a mistake.`);
            }
          }
          return ok();
        }

        await answerCallback(cq.id, 'Unknown action');
        return ok();
      }

      // ── Message ──
      if (body.message?.text) {
        const msg = body.message;
        const chatId: number = msg.chat.id;
        const fromId: number = msg.from.id;
        const tgUsername: string = msg.from.username ?? '';
        const text: string = msg.text.trim();

        // ── Admin messages ──
        if (fromId === ADMIN_TELEGRAM_ID) {
          // /grant_reset <userId>
          if (text.startsWith('/grant_reset ')) {
            const userId = text.split(' ')[1]?.trim();
            if (!userId) { await sendTGMessage(chatId, '❌ Usage: /grant_reset <userId>'); return ok(); }

            const { data: user } = await supabase.from('openflou_users').select('*').eq('id', userId).single();
            if (!user) { await sendTGMessage(chatId, '❌ User not found'); return ok(); }

            const resetToken = generateCode() + generateCode();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('openflou_users').update({
              password_reset_token: resetToken,
              password_reset_expires_at: expiresAt,
              admin_relay_active: false,
            }).eq('id', userId);

            if (user.telegram_chat_id) {
              await sendTGMessage(user.telegram_chat_id,
                `🔑 *Password Reset Authorized*\n\nAdmin verified your identity.\n\nReset code:\n\`${resetToken}\`\n\nOpenflou → Login → *Forgot Password* → *I have a reset code*\n\n⏱ Valid 24 hours`);
            }
            await sendTGMessage(chatId, `✅ Reset token sent to *${user.display_name}*\nToken (admin only): \`${resetToken}\``);
            return ok();
          }

          // /end_support <userId>
          if (text.startsWith('/end_support ')) {
            const userId = text.split(' ')[1]?.trim();
            if (userId) {
              await supabase.from('openflou_users').update({ admin_relay_active: false }).eq('id', userId);
            }
            await sendTGMessage(chatId, '✅ Support session ended.');
            return ok();
          }

          // Relay to active user
          const { data: relayUser } = await supabase
            .from('openflou_users').select('*').eq('admin_relay_active', true).limit(1).maybeSingle();

          if (relayUser?.telegram_chat_id) {
            await sendTGMessage(relayUser.telegram_chat_id, `💬 *Support:* ${text}`);
            await sendTGMessage(chatId, `✉️ Sent to *${relayUser.display_name}*`);
          } else {
            await sendTGMessage(chatId, 'ℹ️ No active support session.\nUse /grant_reset <userId> to issue a reset token.');
          }
          return ok();
        }

        // ── User messages ──

        // Check if user is in relay mode
        const { data: relayCheck } = await supabase
          .from('openflou_users').select('*')
          .eq('telegram_chat_id', chatId).eq('admin_relay_active', true).maybeSingle();

        if (relayCheck) {
          await sendTGMessage(ADMIN_TELEGRAM_ID,
            `📩 *${relayCheck.display_name}* (@${relayCheck.username}):\n\n${text}\n\n_/end_support ${relayCheck.id}_`);
          await sendTGMessage(chatId, '✉️ Message forwarded to support. Please wait for a reply.');
          return ok();
        }

        // /start
        if (text.toLowerCase() === '/start') {
          await sendTGMessage(chatId,
            '👋 *Welcome to Openflou Bot!*\n\n' +
            '🔐 *Link Account:*\n' +
            '  Openflou → Settings → Privacy → Link Telegram\n\n' +
            '🔑 *Login:*\n' +
            '  /login — sign in to linked account\n\n' +
            '🔒 *Recover Password:*\n' +
            '  /recover — reset password via bot\n\n' +
            '🆘 *Need Help:*\n' +
            '  /support @username — contact admin\n\n' +
            '🗑️ *Delete Account:*\n' +
            '  /deleteaccount');
          return ok();
        }

        // /login
        if (text.toLowerCase() === '/login') {
          const { data: user } = await supabase
            .from('openflou_users').select('*')
            .eq('telegram_chat_id', chatId).eq('telegram_verified', true).maybeSingle();

          if (!user) {
            await sendTGMessage(chatId,
              '❌ *No linked account.*\n\nLink Telegram first:\nOpenflou → Settings → Privacy → Link Telegram');
            return ok();
          }

          const loginToken = generateToken(8);
          await supabase.from('openflou_users').update({
            telegram_verification_code: loginToken,
            telegram_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendTGMessage(chatId,
            `✅ *Login Code*\n\nAccount: *${user.display_name}* (@${user.username})\n\nCode: \`${loginToken}\`\n\nOpenflou → Login → *Login with Telegram*\n\n⏱ Valid 24 hours`);
          return ok();
        }

        // /recover
        if (text.toLowerCase() === '/recover') {
          const { data: user } = await supabase
            .from('openflou_users').select('*')
            .eq('telegram_chat_id', chatId).eq('telegram_verified', true).maybeSingle();

          if (!user) {
            await sendTGMessage(chatId,
              '❌ *Account not linked.*\n\nIf you forgot your password and cannot link, use:\n/support @your_username');
            return ok();
          }

          const resetToken = generateCode() + generateCode();
          await supabase.from('openflou_users').update({
            password_reset_token: resetToken,
            password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendTGMessage(chatId,
            `🔑 *Password Reset*\n\nAccount: *${user.display_name}* (@${user.username})\n\nReset code:\n\`${resetToken}\`\n\nOpenflou → Login → *Forgot Password* → *I have a reset code*\n\n⏱ Valid 30 minutes`);
          return ok();
        }

        // /support @username
        if (text.toLowerCase().startsWith('/support')) {
          const parts = text.split(/\s+/);
          const messengerUsername = parts[1] ?? '';

          if (!messengerUsername) {
            await sendTGMessage(chatId,
              '❌ Provide your messenger username.\n\nUsage: `/support @your_username`');
            return ok();
          }

          let userDisplay = `Unknown (Telegram ID: ${fromId})`;
          let userId: string | null = null;

          const { data: linkedUser } = await supabase
            .from('openflou_users').select('*').eq('telegram_chat_id', chatId).maybeSingle();

          if (linkedUser) {
            userDisplay = `*${linkedUser.display_name}* (@${linkedUser.username})`;
            userId = linkedUser.id;
            await supabase.from('openflou_users').update({
              support_request_pending: true,
              support_request_messenger: messengerUsername,
            }).eq('id', linkedUser.id);
          }

          const inlineKeyboard = userId
            ? { inline_keyboard: [[
                { text: '✅ Accept', callback_data: `support_accept:${userId}` },
                { text: '❌ Reject', callback_data: `support_reject:${userId}` },
              ]]}
            : undefined;

          await sendTGMessageWithKeyboard(ADMIN_TELEGRAM_ID,
            `🆘 *Recovery Request*\n\nUser: ${userDisplay}\nTelegram: @${tgUsername} (ID: ${fromId})\nMessenger: ${messengerUsername}\nID: \`${userId ?? 'not linked'}\`\n\n${userId ? 'Use buttons to accept/reject.' : 'No linked account — verify manually.'}`,
            inlineKeyboard);

          await sendTGMessage(chatId,
            `✅ *Request sent!*\n\nAn administrator will review and contact you shortly.\nMessenger: ${messengerUsername}`);
          return ok();
        }

        // /deleteaccount
        if (text.toLowerCase() === '/deleteaccount') {
          const { data: user } = await supabase
            .from('openflou_users').select('*')
            .eq('telegram_chat_id', chatId).eq('telegram_verified', true).maybeSingle();

          if (!user) { await sendTGMessage(chatId, '❌ No linked account found.'); return ok(); }

          const deleteCode = generateCode();
          await supabase.from('openflou_users').update({
            telegram_verification_code: `DELETE_${deleteCode}`,
            telegram_code_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq('id', user.id);

          await sendTGMessage(chatId,
            `⚠️ *Delete Account*\n\nAccount: *${user.display_name}* (@${user.username})\n\n❗ This permanently deletes all data.\n\nConfirm: \`${deleteCode}\`\n\n⏱ Valid 5 minutes`);
          return ok();
        }

        // 6-char verification code
        if (/^[A-Z0-9]{6}$/i.test(text)) {
          const upper = text.toUpperCase();
          const { data: users } = await supabase
            .from('openflou_users').select('*')
            .eq('telegram_verification_code', upper).eq('telegram_verified', false);

          if (users && users.length > 0) {
            const user = users[0];
            if (new Date() > new Date(user.telegram_code_expires_at)) {
              await sendTGMessage(chatId, '❌ Code expired. Generate a new one in the app.');
              return ok();
            }
            if (user.telegram_username && user.telegram_username.toLowerCase() !== tgUsername.toLowerCase()) {
              await sendTGMessage(chatId, `❌ Username mismatch. Code is for @${user.telegram_username}`);
              return ok();
            }
            await supabase.from('openflou_users').update({
              telegram_verified: true,
              telegram_chat_id: chatId,
              telegram_username: tgUsername,
              telegram_verification_code: null,
              telegram_code_expires_at: null,
            }).eq('id', user.id);

            await sendTGMessage(chatId,
              `✅ *Account Linked!*\n\n@${tgUsername} → *${user.display_name}* (@${user.username})\n\nCommands:\n/login — sign in\n/recover — reset password\n/support — contact admin`);
            return ok();
          }
        }

        // Delete confirmation code
        const upper = text.toUpperCase();
        const { data: deleteUsers } = await supabase
          .from('openflou_users').select('*')
          .eq('telegram_verification_code', `DELETE_${upper}`)
          .eq('telegram_chat_id', chatId);

        if (deleteUsers && deleteUsers.length > 0) {
          const user = deleteUsers[0];
          if (new Date() > new Date(user.telegram_code_expires_at)) {
            await sendTGMessage(chatId, '❌ Deletion code expired.');
            return ok();
          }
          await supabase.from('openflou_messages').delete().eq('sender_id', user.id);
          await supabase.from('openflou_contacts').delete().eq('user_id', user.id);
          await supabase.from('openflou_sessions').delete().eq('user_id', user.id);
          const { data: userChats } = await supabase.from('openflou_chats').select('*').contains('participants', [user.id]);
          for (const chat of userChats ?? []) {
            if (chat.participants.length <= 1) {
              await supabase.from('openflou_chats').delete().eq('id', chat.id);
            } else {
              await supabase.from('openflou_chats').update({
                participants: chat.participants.filter((p: string) => p !== user.id),
              }).eq('id', chat.id);
            }
          }
          await supabase.from('openflou_users').delete().eq('id', user.id);
          await sendTGMessage(chatId, `✅ *Account Deleted*\n\n*${user.display_name}* has been permanently removed.`);
          return ok();
        }

        // Unknown command
        await sendTGMessage(chatId, 'ℹ️ Unknown command. Use /start to see available commands.');
      }

      return ok();
    }

    // ================================================================
    // APP API — called from the mobile app
    // ================================================================
    const { action, userId, telegramUsername, loginToken, resetToken, newPassword } = body;

    // Test notification
    if (action === 'test_notification') {
      const { targetUserId } = body;
      let targetChatId: number | null = null;
      let targetName = 'User';

      if (targetUserId) {
        const { data: user } = await supabase
          .from('openflou_users').select('telegram_chat_id, display_name, username')
          .eq('id', targetUserId).single();
        if (user?.telegram_chat_id) {
          targetChatId = user.telegram_chat_id;
          targetName = user.display_name || user.username || 'User';
        }
      }

      await sendTGMessage(ADMIN_TELEGRAM_ID,
        `✅ *Bot Test Successful!*\n\nWebhook: \`${WEBHOOK_URL}\`\nTimestamp: ${new Date().toISOString()}\n\nBot is operational. 🚀`);

      if (targetChatId && targetChatId !== ADMIN_TELEGRAM_ID) {
        await sendTGMessage(targetChatId,
          `✅ *Test Notification*\n\nHello ${targetName}! The Openflou bot is working correctly.`);
      }

      return json({ sent: true, webhookUrl: WEBHOOK_URL });
    }

    // Request Telegram reset
    if (action === 'request_tg_reset') {
      const { username } = body;
      const { data: user } = await supabase
        .from('openflou_users').select('*').eq('username', username).maybeSingle();
      if (!user) return json({ error: 'Account not found' }, 404);
      if (!user.telegram_verified || !user.telegram_chat_id)
        return json({ error: 'No Telegram linked to this account. Use admin support instead.' }, 400);

      const token = generateCode() + generateCode();
      await supabase.from('openflou_users').update({
        password_reset_token: token,
        password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).eq('id', user.id);

      await sendTGMessage(user.telegram_chat_id,
        `🔑 *Password Reset Requested*\n\nAccount: *${user.display_name}*\n\nReset code:\n\`${token}\`\n\nOpenflou → Login → *Forgot Password* → *I have a reset code*\n\n⏱ Valid 30 minutes`);
      return json({ sent: true });
    }

    // Generate verification code
    if (action === 'generate') {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error } = await supabase.from('openflou_users').update({
        telegram_username: (telegramUsername as string)?.toLowerCase(),
        telegram_verification_code: code,
        telegram_code_expires_at: expiresAt,
        telegram_verified: false,
      }).eq('id', userId);
      if (error) throw error;
      return json({ code });
    }

    // Check verification
    if (action === 'check') {
      const { data: user } = await supabase
        .from('openflou_users').select('telegram_verified, telegram_username')
        .eq('id', userId).single();
      return json({ verified: user?.telegram_verified ?? false, username: user?.telegram_username });
    }

    // Telegram login with token
    if (action === 'telegram_login') {
      const { data: user } = await supabase
        .from('openflou_users').select('*')
        .eq('telegram_verification_code', loginToken).eq('telegram_verified', true).single();
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

    // Validate reset token
    if (action === 'validate_reset_token') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('id, username, display_name, password_reset_token, password_reset_expires_at')
        .eq('password_reset_token', resetToken).single();
      if (!user) return json({ valid: false, error: 'Invalid reset token' });
      if (new Date() > new Date(user.password_reset_expires_at)) return json({ valid: false, error: 'Reset token expired' });
      return json({ valid: true, username: user.username, displayName: user.display_name, userId: user.id });
    }

    // Apply password reset
    if (action === 'reset_password') {
      const { data: user } = await supabase
        .from('openflou_users')
        .select('id, password_reset_token, password_reset_expires_at')
        .eq('password_reset_token', resetToken).single();
      if (!user) return json({ error: 'Invalid reset token' }, 400);
      if (new Date() > new Date(user.password_reset_expires_at)) return json({ error: 'Reset token expired' }, 400);

      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword + 'openflou_salt_2024');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

      await supabase.from('openflou_users').update({
        password_hash: hashHex,
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

    // Manual webhook setup (fallback / re-register)
    if (action === 'setup_webhook') {
      const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query'],
          secret_token: BOT_SECRET,
          drop_pending_updates: false,
          max_connections: 40,
        }),
      });
      const data = await res.json();
      const infoRes = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
      const info = await infoRes.json();
      return json({ ...data, currentWebhook: info?.result?.url, targetUrl: WEBHOOK_URL });
    }

    return json({ error: 'Invalid action' }, 400);

  } catch (err: any) {
    console.error('❌ telegram-verify error:', err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ================================================================
// HELPERS
// ================================================================

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

function generateToken(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < len; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function sendTGMessage(chatId: number, text: string): Promise<void> {
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    const result = await r.json();
    if (!result.ok) console.error('❌ sendMessage failed:', result.description, 'chat:', chatId);
  } catch (e) {
    console.error('❌ sendMessage exception:', e);
  }
}

async function sendTGMessageWithKeyboard(chatId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
    });
    const result = await r.json();
    if (!result.ok) console.error('❌ sendMessageWithKeyboard failed:', result.description);
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
