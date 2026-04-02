// Openflou Context - Global State with Backend Integration
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Chat, Message, Contact, User, AppSettings, ThemeType, Language } from '@/types';
import * as storage from '@/services/storage';
import * as api from '@/services/api';
import { lightColors, darkColors } from '@/constants/theme';
import { translations } from '@/constants/translations';
import { Appearance } from 'react-native';

interface OpenFlouContextType {
  // Theme & Language
  theme: ThemeType;
  language: Language;
  colors: typeof lightColors;
  t: typeof translations.en;
  setTheme: (theme: ThemeType) => void;
  setLanguage: (language: Language) => void;
  
  // User
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  updateUser: (user: User) => Promise<void>;
  
  // Chats
  chats: Chat[];
  loadChats: () => Promise<void>;
  addChat: (chat: Chat) => Promise<{ error: string | null }>;
  updateChat: (chat: Chat) => Promise<{ error: string | null }>;
  deleteChat: (chatId: string) => Promise<void>;
  
  // Messages
  getMessagesForChat: (chatId: string) => Promise<Message[]>;
  sendMessage: (message: Message) => Promise<{ error: string | null }>;
  updateMessage: (message: Message) => Promise<{ error: string | null }>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  
  // Contacts
  contacts: Contact[];
  loadContacts: () => Promise<void>;
  addContact: (contact: Contact) => Promise<void>;
  deleteContact: (userId: string) => Promise<void>;
  
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  
  // Reactions
  addReaction: (messageId: string, chatId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, chatId: string, emoji: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const OpenFlouContext = createContext<OpenFlouContextType | undefined>(undefined);

export function OpenFlouProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('light');
  const [language, setLanguageState] = useState<Language>('en');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    language: 'en',
    notifications: true,
    messagePreview: true,
    vibration: true,
    soundEnabled: true,
    autoTheme: false,
    autoThemeMode: 'system',
  });

  const colors = theme === 'dark' ? darkColors : lightColors;
  const t = translations[language];

  useEffect(() => {
    loadSettings();
    loadUserSession();
  }, []);

  // Create "Saved Messages" chat when user logs in
  useEffect(() => {
    if (currentUser) {
      createSavedMessagesChat();
      api.updateSessionActivity(currentUser.id);
      // Validate session every 30s — if session was deleted from another device, log out
      const sessionCheck = setInterval(async () => {
        const sessionId = await storage.getSessionId();
        if (sessionId) {
          const isValid = await api.checkSessionExists(currentUser.id, sessionId);
          if (!isValid) {
            console.log('Session invalidated remotely, logging out');
            await logout();
          }
        }
      }, 30000);
      return () => clearInterval(sessionCheck);
    }
  }, [currentUser?.id]);

  // Load chats when user changes
  useEffect(() => {
    if (currentUser) {
      console.log('Context: User changed, loading chats');
      loadChats();
    }
  }, [currentUser?.id]);

  async function createSavedMessagesChat() {
    if (!currentUser) {
      console.log('⚠️ Context: No current user, skipping saved messages');
      return;
    }
    
    try {
      const savedChatId = `saved_${currentUser.id}`;
      console.log('🔍 Context: Checking for saved chat:', savedChatId);
      
      const existingChats = await api.getChats(currentUser.id);
      const hasSavedChat = existingChats.some((c) => c.id === savedChatId);
      
      console.log('🔍 Context: Has saved chat?', hasSavedChat, 'Existing chats:', existingChats.length);
      
      if (!hasSavedChat) {
        const savedChat: Chat = {
          id: savedChatId,
          type: 'saved',
          name: t.savedMessages || 'Saved Messages',
          avatar: currentUser.avatar,
          participants: [currentUser.id],
          admins: [currentUser.id],
          unreadCount: 0,
          isPinned: true,
          isMuted: false,
          createdAt: new Date(),
        };
        
        console.log('📝 Context: Creating saved messages chat:', savedChat);
        const result = await api.createChat(savedChat);
        if (result.error) {
          console.error('❌ Context: Failed to create saved messages:', result.error);
        } else {
          console.log('✅ Context: Created saved messages chat successfully');
          await loadChats();
        }
      } else {
        console.log('✅ Context: Saved messages chat already exists');
      }
    } catch (error) {
      console.error('❌ Context: Error creating saved messages:', error);
    }
  }

  async function loadUserSession() {
    const savedUser = await storage.getCurrentUser();
    if (savedUser) {
      console.log('Context: Loaded user from storage:', savedUser.username);
      setCurrentUser(savedUser);
    }
  }

  useEffect(() => {
    if (settings.autoTheme) {
      if (settings.autoThemeMode === 'system') {
        const systemTheme = Appearance.getColorScheme();
        if (systemTheme) {
          setThemeState(systemTheme);
        }
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
          if (colorScheme) {
            setThemeState(colorScheme);
          }
        });
        return () => subscription.remove();
      } else if (settings.autoThemeMode === 'time') {
        const checkTimeTheme = () => {
          const hour = new Date().getHours();
          const newTheme = hour >= 20 || hour < 6 ? 'dark' : 'light';
          setThemeState(newTheme);
        };
        checkTimeTheme();
        const interval = setInterval(checkTimeTheme, 60000);
        return () => clearInterval(interval);
      }
    }
  }, [settings.autoTheme, settings.autoThemeMode]);

  async function loadSettings() {
    const savedSettings = await storage.getSettings();
    setSettings(savedSettings);
    setThemeState(savedSettings.theme);
    setLanguageState(savedSettings.language);
  }

  async function setTheme(newTheme: ThemeType) {
    setThemeState(newTheme);
    await updateSettings({ theme: newTheme });
  }

  async function setCurrentUserWrapper(user: User | null) {
    console.log('Context: Setting current user:', user?.username || 'null');
    setCurrentUser(user);
    if (user) {
      await storage.saveCurrentUser(user);
      await storage.saveAuthState({
        isAuthenticated: true,
        currentUser: user,
        isNewUser: false,
      });
    } else {
      await storage.clearCurrentUser();
      await storage.saveAuthState({
        isAuthenticated: false,
        currentUser: null,
        isNewUser: false,
      });
    }
  }

  async function updateUser(user: User) {
    const { error } = await api.updateUser(user);
    if (!error) {
      setCurrentUser(user);
      await storage.saveCurrentUser(user);
    }
  }

  async function setLanguage(newLanguage: Language) {
    setLanguageState(newLanguage);
    await updateSettings({ language: newLanguage });
  }

  async function updateSettings(updates: Partial<AppSettings>) {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await storage.saveSettings(newSettings);
  }

  async function loadChats() {
    if (!currentUser) {
      console.log('⚠️ Context: No user, cannot load chats');
      return;
    }
    
    console.log('🔄 Context: Loading chats for user:', currentUser.id, currentUser.username);
    try {
      const loadedChats = await api.getChats(currentUser.id);
      console.log('✅ Context: Loaded chats:', loadedChats.length, loadedChats.map(c => ({ id: c.id, type: c.type, name: c.name })));
      setChats(loadedChats);
    } catch (error) {
      console.error('❌ Context: Error loading chats:', error);
    }
  }

  async function addChat(chat: Chat): Promise<{ error: string | null }> {
    console.log('📝 Context: Adding chat:', chat.name, 'type:', chat.type, 'id:', chat.id);
    const { error } = await api.createChat(chat);
    if (!error) {
      console.log('✅ Context: Chat created, reloading list');
      await loadChats();
    } else {
      console.error('❌ Context: Error creating chat:', error);
    }
    return { error };
  }

  async function updateChat(chat: Chat): Promise<{ error: string | null }> {
    const { error } = await api.updateChat(chat);
    if (!error) {
      setChats((prev) => prev.map((c) => (c.id === chat.id ? chat : c)));
    }
    return { error };
  }

  async function deleteChat(chatId: string) {
    const { error } = await api.deleteChat(chatId);
    if (!error) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    }
  }

  async function getMessagesForChat(chatId: string): Promise<Message[]> {
    return await api.getMessages(chatId);
  }

  async function sendMessage(message: Message): Promise<{ error: string | null }> {
    const { error } = await api.sendMessage(message.chatId, message);
    
    if (!error) {
      // Update chat's last message
      const chat = chats.find((c) => c.id === message.chatId);
      if (chat) {
        chat.lastMessage = message;
        await updateChat(chat);
      }
    }
    return { error };
  }

  async function updateMessage(message: Message): Promise<{ error: string | null }> {
    return await api.updateMessage(message);
  }

  async function deleteMessage(chatId: string, messageId: string) {
    await api.deleteMessage(chatId, messageId);
  }

  async function loadContacts() {
    if (!currentUser) return;
    const loadedContacts = await api.getContacts(currentUser.id);
    setContacts(loadedContacts);
  }

  async function addContact(contact: Contact) {
    if (!currentUser) return;
    const { error } = await api.addContact(currentUser.id, contact.userId);
    if (!error) {
      setContacts((prev) => [...prev, contact]);
    }
  }

  async function deleteContact(userId: string) {
    if (!currentUser) return;
    const { error } = await api.removeContact(currentUser.id, userId);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.userId !== userId));
    }
  }

  async function addReaction(messageId: string, chatId: string, emoji: string) {
    if (!currentUser) return;
    
    const messages = await api.getMessages(chatId);
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    if (!message.reactions) {
      message.reactions = [];
    }

    const existingReaction = message.reactions.find(
      (r) => r.emoji === emoji && r.userId === currentUser.id
    );

    if (existingReaction) {
      return;
    }

    message.reactions.push({
      emoji,
      userId: currentUser.id,
      timestamp: new Date(),
    });

    await updateMessage(message);
  }

  async function removeReaction(messageId: string, chatId: string, emoji: string) {
    if (!currentUser) return;
    
    const messages = await api.getMessages(chatId);
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.reactions) return;

    message.reactions = message.reactions.filter(
      (r) => !(r.emoji === emoji && r.userId === currentUser.id)
    );

    await updateMessage(message);
  }

  async function logout() {
    console.log('🚪 Context: Logging out user:', currentUser?.username);
    
    if (currentUser) {
      // Update user status to offline
      await api.updateUserStatus(currentUser.id, false);
    }
    
    // Clear all state
    setCurrentUser(null);
    setChats([]);
    setContacts([]);
    
    // Clear storage
    await storage.clearCurrentUser();
    await storage.clearAuthState();
    await storage.clearSessionId();
    
    console.log('✅ Context: Logout complete');
  }

  return (
    <OpenFlouContext.Provider
      value={{
        theme,
        language,
        colors,
        t,
        setTheme,
        setLanguage,
        currentUser,
        setCurrentUser: setCurrentUserWrapper,
        updateUser,
        chats,
        loadChats,
        addChat,
        updateChat,
        deleteChat,
        getMessagesForChat,
        sendMessage,
        updateMessage,
        deleteMessage,
        contacts,
        loadContacts,
        addContact,
        deleteContact,
        settings,
        updateSettings,
        addReaction,
        removeReaction,
        logout,
      }}
    >
      {children}
    </OpenFlouContext.Provider>
  );
}
