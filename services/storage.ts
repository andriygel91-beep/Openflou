// Openflou Local Storage Service - P2P Data Layer
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Message, Chat, Contact, AppSettings, AuthState } from '@/types';

const KEYS = {
  AUTH: '@openflou_auth',
  CURRENT_USER: '@openflou_current_user',
  USERS: '@openflou_users',
  MESSAGES: '@openflou_messages',
  CHATS: '@openflou_chats',
  CONTACTS: '@openflou_contacts',
  SETTINGS: '@openflou_settings',
};

// Auth Storage
export async function saveAuthState(auth: AuthState): Promise<void> {
  await AsyncStorage.setItem(KEYS.AUTH, JSON.stringify(auth));
}

export async function getAuthState(): Promise<AuthState | null> {
  const data = await AsyncStorage.getItem(KEYS.AUTH);
  return data ? JSON.parse(data) : null;
}

export async function clearAuthState(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.AUTH);
}

// Current User Session Storage
export async function saveCurrentUser(user: User): Promise<void> {
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
}

export async function getCurrentUser(): Promise<User | null> {
  const data = await AsyncStorage.getItem(KEYS.CURRENT_USER);
  return data ? JSON.parse(data) : null;
}

export async function clearCurrentUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
}

// User Storage (P2P Network)
export async function saveUser(user: User): Promise<void> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(users));
}

export async function getUsers(): Promise<User[]> {
  const data = await AsyncStorage.getItem(KEYS.USERS);
  return data ? JSON.parse(data) : [];
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

// Message Storage
export async function saveMessage(message: Message): Promise<void> {
  const messages = await getMessages(message.chatId);
  messages.push(message);
  await AsyncStorage.setItem(`${KEYS.MESSAGES}_${message.chatId}`, JSON.stringify(messages));
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const data = await AsyncStorage.getItem(`${KEYS.MESSAGES}_${chatId}`);
  return data ? JSON.parse(data) : [];
}

export async function updateMessage(message: Message): Promise<void> {
  const messages = await getMessages(message.chatId);
  const index = messages.findIndex((m) => m.id === message.id);
  if (index >= 0) {
    messages[index] = message;
    await AsyncStorage.setItem(`${KEYS.MESSAGES}_${message.chatId}`, JSON.stringify(messages));
  }
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  const messages = await getMessages(chatId);
  const filtered = messages.filter((m) => m.id !== messageId);
  await AsyncStorage.setItem(`${KEYS.MESSAGES}_${chatId}`, JSON.stringify(filtered));
}

// Chat Storage
export async function saveChat(chat: Chat): Promise<void> {
  const chats = await getChats();
  const index = chats.findIndex((c) => c.id === chat.id);
  if (index >= 0) {
    chats[index] = chat;
  } else {
    chats.push(chat);
  }
  await AsyncStorage.setItem(KEYS.CHATS, JSON.stringify(chats));
}

export async function getChats(): Promise<Chat[]> {
  const data = await AsyncStorage.getItem(KEYS.CHATS);
  return data ? JSON.parse(data) : [];
}

export async function getChatById(chatId: string): Promise<Chat | null> {
  const chats = await getChats();
  return chats.find((c) => c.id === chatId) || null;
}

export async function deleteChat(chatId: string): Promise<void> {
  const chats = await getChats();
  const filtered = chats.filter((c) => c.id !== chatId);
  await AsyncStorage.setItem(KEYS.CHATS, JSON.stringify(filtered));
  await AsyncStorage.removeItem(`${KEYS.MESSAGES}_${chatId}`);
}

// Contact Storage
export async function saveContact(contact: Contact): Promise<void> {
  const contacts = await getContacts();
  const index = contacts.findIndex((c) => c.userId === contact.userId);
  if (index >= 0) {
    contacts[index] = contact;
  } else {
    contacts.push(contact);
  }
  await AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
}

export async function getContacts(): Promise<Contact[]> {
  const data = await AsyncStorage.getItem(KEYS.CONTACTS);
  return data ? JSON.parse(data) : [];
}

export async function deleteContact(userId: string): Promise<void> {
  const contacts = await getContacts();
  const filtered = contacts.filter((c) => c.userId !== userId);
  await AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(filtered));
}

// Settings Storage
export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  return data
    ? JSON.parse(data)
    : {
        theme: 'light',
        language: 'en',
        notifications: true,
        messagePreview: true,
        vibration: true,
        soundEnabled: true,
        autoTheme: false,
        autoThemeMode: 'system',
      };
}
