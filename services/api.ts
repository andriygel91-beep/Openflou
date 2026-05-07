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

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.error) {
      return { user: null, error: data.error };
    }

    // Create session
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

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.error) {
      return { user: null, error: data.error };
    }

    // Create session
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

// ==================== SESSIONS ====================

async function createSession(userId: string): Promise<void> {
  try {
    const storageModule = await import('@/services/storage');
    
    // Check if we already have a valid session ID stored locally
    const existingSessionId = await storageModule.getSessionId();
    if (existingSessionId) {
      // Verify it still exists on server
      const { data: existing } = await supabase
        .from('openflou_sessions')
        .select('id')
        .eq('id', existingSessionId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existing?.id) {
        // Session is valid — just refresh activity
        await supabase
          .from('openflou_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('id', existing.id);
        console.log('✅ Reused existing session:', existing.id);
        return;
      }
    }

    // Create new session
    const deviceName = Device.deviceName || `Device_${Date.now()}`;
    const deviceType = Device.modelName || 'Unknown Model';
    const platform = Device.osName || 'Unknown OS';

    let ipAddress = 'Unknown';
    try {
      const ip = await Network.getIpAddressAsync();
      ipAddress = ip || 'Unknown';
    } catch {
      // Ignore IP fetch errors
    }

    const { data, error } = await supabase.from('openflou_sessions').insert({
      user_id: userId,
      device_name: deviceName,
      device_type: deviceType,
      platform,
      ip_address: ipAddress,
    }).select('id').single();

    if (data?.id && !error) {
      await storageModule.saveSessionId(data.id);
      console.log('✅ Created new session:', data.id);
    } else if (error) {
      console.error('❌ Session insert error:', error);
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
    console.log('🗑️ API: Deleting session:', sessionId);
    
    const { error } = await supabase
      .from('openflou_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Delete session error:', error);
      throw error;
    }
    
    console.log('✅ Session deleted successfully');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Delete session exception:', error);
    return { error: error.message };
  }
}

export async function deleteAllOtherSessions(userId: string, currentSessionId: string) {
  try {
    console.log('🗑️ API: Deleting all other sessions for user:', userId);
    
    const { error } = await supabase
      .from('openflou_sessions')
      .delete()
      .eq('user_id', userId)
      .neq('id', currentSessionId);

    if (error) {
      console.error('❌ Delete all sessions error:', error);
      throw error;
    }
    
    console.log('✅ All other sessions deleted');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Delete all sessions exception:', error);
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
    // display_name lives in openflou_users
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
    console.log('✅ API: Getting chats for user:', userId);
    
    const { data, error } = await supabase
      .from('openflou_chats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Get chats DB error:', error);
      throw error;
    }

    console.log('📊 API: Raw chats from DB:', data?.length || 0, data?.map(c => ({ id: c.id, type: c.type, name: c.name, participants: c.participants })));

    // Filter chats where user is participant
    const userChats = (data || []).filter((chat) => {
      // Saved messages
      if (chat.type === 'saved') {
        const match = chat.id === `saved_${userId}`;
        console.log('🔍 Saved chat check:', chat.id, 'expected:', `saved_${userId}`, 'match:', match);
        return match;
      }
      // For other chats, check participants array
      if (!chat.participants || !Array.isArray(chat.participants)) {
        console.log('⚠️ Chat has no participants array:', chat.id);
        return false;
      }
      const isParticipant = chat.participants.includes(userId);
      console.log('🔍 Chat participant check:', chat.id, 'type:', chat.type, 'participants:', chat.participants, 'userId:', userId, 'match:', isParticipant);
      return isParticipant;
    });

    console.log('✅ API: Filtered user chats:', userChats.length);

    // For each chat, get last message
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

    console.log('✅ API: Returning chats with messages:', chatsWithMessages.length);
    return chatsWithMessages;
  } catch (error) {
    console.error('❌ Get chats error:', error);
    return [];
  }
}

export async function createChat(chat: Chat): Promise<{ error: string | null }> {
  try {
    console.log('📝 API: Creating chat:', chat.id, 'type:', chat.type, 'name:', chat.name, 'participants:', chat.participants);
    
    const { data, error } = await supabase.from('openflou_chats').insert({
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
    }).select();

    if (error) {
      console.error('❌ Create chat error:', error);
      throw error;
    }
    
    console.log('✅ Chat created:', data);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Create chat exception:', error);
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

    // Add disappearing messages fields if they exist
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
    const { error } = await supabase
      .from('openflou_chats')
      .delete()
      .eq('id', chatId);

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
    // Check permissions
    const { data: chatData, error: chatError } = await supabase
      .from('openflou_chats')
      .select('type, admins, creator_id, banned_users')
      .eq('id', chatId)
      .single();

    if (chatError) throw chatError;

    // Check if user is banned
    if (chatData.banned_users && chatData.banned_users.includes(message.senderId)) {
      return { error: 'You are banned from this chat' };
    }

    // Channel: only admins and creator can send
    if (chatData.type === 'channel') {
      const isAdmin = chatData.admins?.includes(message.senderId);
      const isCreator = chatData.creator_id === message.senderId;
      
      if (!isAdmin && !isCreator) {
        return { error: 'Only admins can send messages in this channel' };
      }
    }

    const { data, error } = await supabase.functions.invoke('openflou-messages', {
      body: {
        action: 'send',
        message: {
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          encryptedContent: message.encryptedContent,
          mediaUrl: message.mediaUrl,
        },
      },
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
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
    const { data, error } = await supabase.functions.invoke('openflou-messages', {
      body: {
        action: 'delete',
        messageId,
      },
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

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

// ==================== SEARCH CHATS BY USERNAME ====================

// Global user search
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
      if (error.code === 'PGRST116') {
        return { chat: null, error: 'Chat not found' };
      }
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
    // Get current chat
    const { data, error } = await supabase
      .from('openflou_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) throw error;

    // Check if already a participant
    if (data.participants && data.participants.includes(userId)) {
      return { error: 'Already a member' };
    }

    // Add user to participants
    const newParticipants = [...(data.participants || []), userId];

    const { error: updateError } = await supabase
      .from('openflou_chats')
      .update({
        participants: newParticipants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}
