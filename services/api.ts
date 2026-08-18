// Openflou API Service - Backend Integration
import { getSupabaseClient } from '@/template';
import { User, Message, Chat, Contact } from '@/types';
import * as Device from 'expo-device';
import * as Network from 'expo-network';

const supabase = getSupabaseClient();

// ==================== AUTH ====================

export async function signUp(username: string, displayName: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('openflou-auth', {
      body: { action: 'signup', username: username.toLowerCase(), displayName, password },
    });
    if (error) return { user: null, error: error.message };
    if (data.error) return { user: null, error: data.error };
    await createSession(data.user.id);
    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || 'Sign up failed' };
  }
}

export async function signIn(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('openflou-auth', {
      body: { action: 'signin', username: username.toLowerCase(), password },
    });
    if (error) return { user: null, error: error.message };
    if (data.error) return { user: null, error: data.error };
    await createSession(data.user.id);
    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || 'Sign in failed' };
  }
}

export async function updateUserStatus(userId: string, isOnline: boolean): Promise<void> {
  try {
    await supabase.functions.invoke('openflou-auth', {
      body: { action: 'updateStatus', userId, isOnline },
    });
  } catch (error) {
    console.error('Update status error:', error);
  }
}

/**
 * Update is_online flag and last_seen timestamp directly.
 */
export async function updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  try {
    await supabase
      .from('openflou_users')
      .update({
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch (error) {
    console.error('updateUserOnlineStatus error:', error);
  }
}

/**
 * Heartbeat — update last_seen every N seconds while app is active.
 * Returns cleanup function.
 */
export function startOnlineHeartbeat(userId: string, intervalMs = 30000): () => void {
  const tick = () => updateUserOnlineStatus(userId, true);
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}

// ==================== SESSIONS ====================

async function createSession(userId: string): Promise<void> {
  try {
    const storageModule = await import('@/services/storage');
    const existingSessionId = await storageModule.getSessionId();
    if (existingSessionId) {
      const { data: existing } = await supabase
        .from('openflou_sessions')
        .select('id')
        .eq('id', existingSessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing?.id) {
        await supabase
          .from('openflou_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('id', existing.id);
        console.log('Reused existing session:', existing.id);
        return;
      }
    }

    const deviceName = Device.deviceName || `Device_${Date.now()}`;
    const deviceType = Device.modelName || 'Unknown Model';
    const platform = Device.osName || 'Unknown OS';
    let ipAddress = 'Unknown';
    try {
      const ip = await Network.getIpAddressAsync();
      ipAddress = ip || 'Unknown';
    } catch { /* ignore */ }

    const { data, error } = await supabase.from('openflou_sessions').insert({
      user_id: userId,
      device_name: deviceName,
      device_type: deviceType,
      platform,
      ip_address: ipAddress,
    }).select('id').single();

    if (data?.id && !error) {
      await storageModule.saveSessionId(data.id);
      console.log('Created new session:', data.id);
    } else if (error) {
      console.error('Session insert error:', error);
    }
  } catch (error) {
    console.error('Create session error:', error);
  }
}

export async function getSessions(userId: string) {
  try {
    const { data, error } = await supabase
      .from('openflou_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false });
    if (error) throw error;
    return { sessions: data || [], error: null };
  } catch (error: any) {
    return { sessions: [], error: error.message };
  }
}

export async function deleteSession(sessionId: string) {
  try {
    const { error } = await supabase
      .from('openflou_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteAllOtherSessions(userId: string, currentSessionId: string) {
  try {
    const { error } = await supabase
      .from('openflou_sessions')
      .delete()
      .eq('user_id', userId)
      .neq('id', currentSessionId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateSessionActivity(userId: string): Promise<void> {
  try {
    const storageModule = await import('@/services/storage');
    const sessionId = await storageModule.getSessionId();
    if (!sessionId) return;
    await supabase
      .from('openflou_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Update session activity error:', error);
  }
}

// ==================== USERS ====================

export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('openflou_users')
      .select('*')
      .order('username');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('openflou_users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export async function updateUser(user: User): Promise<{ error: string | null }> {
  try {
    const updatePayload: Record<string, any> = {
      username: user.username?.toLowerCase(),
      avatar: user.avatar ?? null,
      bio: user.bio ?? null,
      is_online: user.isOnline ?? false,
      updated_at: new Date().toISOString(),
    };
    if ('display_name' in user) {
      updatePayload['display_name'] = (user as any).display_name || user.username;
    }
    const { error } = await supabase
      .from('openflou_users')
      .update(updatePayload)
      .eq('id', user.id);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ==================== CHATS ====================

export async function getChats(userId: string): Promise<Chat[]> {
  try {
    const { data, error } = await supabase
      .from('openflou_chats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const userChats = (data || []).filter((chat) => {
      if (chat.type === 'saved') return chat.id === `saved_${userId}`;
      if (!chat.participants || !Array.isArray(chat.participants)) return false;
      return chat.participants.includes(userId);
    });

    const chatsWithMessages = await Promise.all(
      userChats.map(async (chat) => {
        const messages = await getMessages(chat.id);
        const lastMessage = messages[messages.length - 1];
        return {
          id: chat.id,
          type: chat.type,
          name: chat.name,
          username: chat.username,
          avatar: chat.avatar,
          description: chat.description,
          participants: chat.participants,
          admins: chat.admins || [],
          creatorId: chat.creator_id,
          bannedUsers: chat.banned_users || [],
          pinnedMessageId: chat.pinned_message_id,
          disappearingMessagesEnabled: chat.disappearing_messages_enabled,
          disappearingMessagesTimer: chat.disappearing_messages_timer,
          lastMessage,
          unreadCount: 0,
          isPinned: chat.type === 'saved',
          isMuted: false,
          createdAt: new Date(chat.created_at),
        };
      })
    );

    return chatsWithMessages;
  } catch (error) {
    console.error('Get chats error:', error);
    return [];
  }
}

export async function createChat(chat: Chat): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('openflou_chats').insert({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      username: chat.username,
      avatar: chat.avatar,
      description: chat.description,
      participants: chat.participants,
      admins: chat.admins || [],
      creator_id: chat.creatorId,
      banned_users: chat.bannedUsers || [],
      pinned_message_id: chat.pinnedMessageId,
    });
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Create chat error:', error);
    return { error: error.message };
  }
}

export async function updateChat(chat: Chat): Promise<{ error: string | null }> {
  try {
    const updateData: any = {
      name: chat.name,
      username: chat.username,
      avatar: chat.avatar,
      description: chat.description,
      participants: chat.participants,
      admins: chat.admins,
      creator_id: chat.creatorId,
      banned_users: chat.bannedUsers,
      pinned_message_id: chat.pinnedMessageId,
      updated_at: new Date().toISOString(),
    };
    if (chat.disappearingMessagesEnabled !== undefined) {
      updateData.disappearing_messages_enabled = chat.disappearingMessagesEnabled;
    }
    if (chat.disappearingMessagesTimer !== undefined) {
      updateData.disappearing_messages_timer = chat.disappearingMessagesTimer;
    }
    const { error } = await supabase
      .from('openflou_chats')
      .update(updateData)
      .eq('id', chat.id);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteChat(chatId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('openflou_chats').delete().eq('id', chatId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ==================== MESSAGES ====================

export async function getMessages(chatId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('openflou_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (data || []).map((msg) => ({
      id: msg.id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      content: msg.content || '',
      type: msg.type as Message['type'],
      encryptedContent: msg.encrypted_content,
      mediaUrl: msg.media_url || undefined,
      reactions: msg.reactions || [],
      isEdited: msg.is_edited || false,
      timestamp: new Date(msg.timestamp),
      isRead: false,
    }));
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export async function sendMessage(chatId: string, message: Message): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('openflou_messages')
      .insert({
        chat_id: message.chatId,
        sender_id: message.senderId,
        content: message.content || '',
        type: message.type,
        encrypted_content: message.encryptedContent || null,
        media_url: message.mediaUrl || null,
        iv: (message as any).iv || null,
        reactions: message.reactions || [],
      });

    if (error) throw error;

    // Update chat timestamp (fire-and-forget)
    supabase
      .from('openflou_chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .then(() => {});

    // Update sender last_seen (fire-and-forget)
    supabase
      .from('openflou_users')
      .update({ last_seen: new Date().toISOString(), is_online: true })
      .eq('id', message.senderId)
      .then(() => {});

    // Send push notifications to other participants (fire-and-forget)
    sendPushToParticipants(chatId, message).catch(() => {});

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

async function sendPushToParticipants(chatId: string, message: Message): Promise<void> {
  try {
    const { data: chat } = await supabase
      .from('openflou_chats')
      .select('participants, name')
      .eq('id', chatId)
      .single();
    if (!chat?.participants) return;

    const { data: sender } = await supabase
      .from('openflou_users')
      .select('display_name, username')
      .eq('id', message.senderId)
      .single();

    const senderName = (sender as any)?.display_name || (sender as any)?.username || 'Someone';
    const chatName = chat.participants.length > 2 ? chat.name : undefined;

    let notifBody = message.content || '';
    if (message.type === 'photo') notifBody = '\ud83d\udcf7 Photo';
    else if (message.type === 'video') notifBody = '\ud83c\udfa5 Video';
    else if (message.type === 'voice') notifBody = '\ud83c\udfa4 Voice message';
    else if (message.type === 'file') notifBody = '\ud83d\udcce File';
    else if (!notifBody) notifBody = 'New message';
    if (notifBody.length > 100) notifBody = notifBody.slice(0, 100) + '\u2026';

    const otherIds = chat.participants.filter((id: string) => id !== message.senderId);
    if (otherIds.length === 0) return;

    const { data: users } = await supabase
      .from('openflou_users')
      .select('push_token')
      .in('id', otherIds)
      .not('push_token', 'is', null);

    const tokens = (users || []).map((u: any) => u.push_token).filter(Boolean);
    if (tokens.length === 0) return;

    const pushMessages = tokens.map((token: string) => ({
      to: token,
      title: chatName ? `${senderName} in ${chatName}` : senderName,
      body: notifBody,
      data: { chatId },
      sound: 'default',
      badge: 1,
      channelId: 'messages',
      priority: 'high',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(pushMessages.length === 1 ? pushMessages[0] : pushMessages),
    });
  } catch (err) {
    console.error('Push notification error:', err);
  }
}

/**
 * Send a high-priority call push to the callee (shows on locked screen).
 */
export async function sendCallPushNotification(
  calleeId: string,
  callerName: string,
  callType: string,
  chatId: string,
  callId: string,
  callerId: string
): Promise<void> {
  try {
    const { data: callee } = await supabase
      .from('openflou_users')
      .select('push_token')
      .eq('id', calleeId)
      .single();

    const token = (callee as any)?.push_token;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: callType === 'video' ? '\ud83d\udcf9 Incoming Video Call' : '\ud83d\udcde Incoming Voice Call',
        body: `${callerName} is calling...`,
        data: { chatId, callId, callerId, type: callType, action: 'incoming_call' },
        sound: 'default',
        channelId: 'calls',
        priority: 'max',
        ttl: 30,
      }),
    });
  } catch (err) {
    console.error('Call push notification error:', err);
  }
}

export async function updateMessage(message: Message): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('openflou_messages')
      .update({
        content: message.content,
        is_edited: true,
        reactions: message.reactions || [],
      })
      .eq('id', message.id);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteMessage(chatId: string, messageId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('openflou_messages')
      .delete()
      .eq('id', messageId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function checkSessionExists(userId: string, sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('openflou_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

// ==================== CONTACTS ====================

export async function getContacts(userId: string): Promise<Contact[]> {
  try {
    const { data, error } = await supabase
      .from('openflou_contacts')
      .select('contact_id')
      .eq('user_id', userId);
    if (error) throw error;

    const contactIds = (data || []).map((c) => c.contact_id);
    if (contactIds.length === 0) return [];

    const { data: users, error: usersError } = await supabase
      .from('openflou_users')
      .select('*')
      .in('id', contactIds);
    if (usersError) throw usersError;

    return (users || []).map((user) => ({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      isOnline: user.is_online,
      lastSeen: new Date(user.last_seen),
      addedAt: new Date(),
    }));
  } catch (error) {
    console.error('Get contacts error:', error);
    return [];
  }
}

export async function addContact(userId: string, contactId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('openflou_contacts').insert({
      user_id: userId,
      contact_id: contactId,
    });
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function removeContact(userId: string, contactId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('openflou_contacts')
      .delete()
      .eq('user_id', userId)
      .eq('contact_id', contactId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ==================== SEARCH ====================

export async function searchUsersByUsername(query: string): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('openflou_users')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .order('username')
      .limit(50);
    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

export async function searchChatByUsername(username: string): Promise<{ chat: Chat | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('openflou_chats')
      .select('*')
      .eq('username', username)
      .in('type', ['group', 'channel'])
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { chat: null, error: 'Chat not found' };
      throw error;
    }

    const messages = await getMessages(data.id);
    const lastMessage = messages[messages.length - 1];

    const chat: Chat = {
      id: data.id,
      type: data.type,
      name: data.name,
      username: data.username,
      avatar: data.avatar,
      description: data.description,
      participants: data.participants,
      admins: data.admins || [],
      creatorId: data.creator_id,
      bannedUsers: data.banned_users || [],
      pinnedMessageId: data.pinned_message_id,
      disappearingMessagesEnabled: data.disappearing_messages_enabled,
      disappearingMessagesTimer: data.disappearing_messages_timer,
      lastMessage,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(data.created_at),
    };

    return { chat, error: null };
  } catch (error: any) {
    return { chat: null, error: error.message };
  }
}

export async function joinChat(chatId: string, userId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('openflou_chats')
      .select('*')
      .eq('id', chatId)
      .single();
    if (error) throw error;

    if (data.participants && data.participants.includes(userId)) {
      return { error: 'Already a member' };
    }

    const newParticipants = [...(data.participants || []), userId];
    const { error: updateError } = await supabase
      .from('openflou_chats')
      .update({ participants: newParticipants, updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (updateError) throw updateError;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}
