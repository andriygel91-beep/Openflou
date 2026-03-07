// Openflou API Service - Backend Integration
import { getSupabaseClient } from '@/template';
import { User, Message, Chat, Contact } from '@/types';
import * as Device from 'expo-device';
import * as Network from 'expo-network';

const supabase = getSupabaseClient();

// ==================== AUTH ====================

export async function signUp(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('openflou-auth', {
      body: { action: 'signup', username, password },
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
      body: { action: 'signin', username, password },
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
    const deviceName = Device.deviceName || 'Unknown Device';
    const deviceType = Device.modelName || 'Unknown Model';
    const platform = Device.osName || 'Unknown OS';
    
    let ipAddress = 'Unknown';
    try {
      const ip = await Network.getIpAddressAsync();
      ipAddress = ip || 'Unknown';
    } catch {
      // Ignore IP fetch errors
    }

    await supabase.from('openflou_sessions').insert({
      user_id: userId,
      device_name: deviceName,
      device_type: deviceType,
      platform,
      ip_address: ipAddress,
    });
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

export async function updateSessionActivity(userId: string): Promise<void> {
  try {
    const deviceName = Device.deviceName || 'Unknown Device';
    
    await supabase
      .from('openflou_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_name', deviceName);
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
    const { error } = await supabase
      .from('openflou_users')
      .update({
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        is_online: user.isOnline,
        updated_at: new Date().toISOString(),
      })
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

    if (error) {
      console.error('Get chats DB error:', error);
      throw error;
    }

    // Filter chats where user is participant
    const userChats = (data || []).filter((chat) => 
      chat.participants && Array.isArray(chat.participants) && chat.participants.includes(userId)
    );

    // For each chat, get last message
    const chatsWithMessages = await Promise.all(
      userChats.map(async (chat) => {
        const messages = await getMessages(chat.id);
        const lastMessage = messages[messages.length - 1];
        
        return {
          id: chat.id,
          type: chat.type,
          name: chat.name,
          avatar: chat.avatar,
          description: chat.description,
          participants: chat.participants,
          admins: chat.admins || [],
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
      avatar: chat.avatar,
      description: chat.description,
      participants: chat.participants,
      admins: chat.admins || [],
    });

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateChat(chat: Chat): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('openflou_chats')
      .update({
        name: chat.name,
        avatar: chat.avatar,
        description: chat.description,
        participants: chat.participants,
        admins: chat.admins,
        updated_at: new Date().toISOString(),
      })
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
      content: msg.content,
      type: msg.type,
      encryptedContent: msg.encrypted_content,
      mediaUrl: msg.media_url,
      reactions: msg.reactions || [],
      isEdited: msg.is_edited,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export async function sendMessage(message: Message): Promise<{ error: string | null }> {
  try {
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
