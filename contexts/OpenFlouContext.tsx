// Openflou Context - Global State Management
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Chat, Message, Contact, User, AppSettings, ThemeType, Language, Reaction } from '@/types';
import * as storage from '@/services/storage';
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
  
  // Chats
  chats: Chat[];
  loadChats: () => Promise<void>;
  addChat: (chat: Chat) => Promise<void>;
  updateChat: (chat: Chat) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  
  // Messages
  getMessagesForChat: (chatId: string) => Promise<Message[]>;
  sendMessage: (message: Message) => Promise<void>;
  updateMessage: (message: Message) => Promise<void>;
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

  async function loadUserSession() {
    const savedUser = await storage.getCurrentUser();
    if (savedUser) {
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

  async function setCurrentUserAndSave(user: User | null) {
    setCurrentUser(user);
    if (user) {
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
    const loadedChats = await storage.getChats();
    setChats(loadedChats);
  }

  async function addChat(chat: Chat) {
    await storage.saveChat(chat);
    setChats((prev) => [...prev, chat]);
  }

  async function updateChat(chat: Chat) {
    await storage.saveChat(chat);
    setChats((prev) => prev.map((c) => (c.id === chat.id ? chat : c)));
  }

  async function deleteChat(chatId: string) {
    await storage.deleteChat(chatId);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  }

  async function getMessagesForChat(chatId: string): Promise<Message[]> {
    return await storage.getMessages(chatId);
  }

  async function sendMessage(message: Message) {
    await storage.saveMessage(message);
    
    // Update chat's last message
    const chat = chats.find((c) => c.id === message.chatId);
    if (chat) {
      chat.lastMessage = message;
      await updateChat(chat);
    }
  }

  async function updateMessage(message: Message) {
    await storage.updateMessage(message);
  }

  async function deleteMessage(chatId: string, messageId: string) {
    await storage.deleteMessage(chatId, messageId);
  }

  async function loadContacts() {
    const loadedContacts = await storage.getContacts();
    setContacts(loadedContacts);
  }

  async function addContact(contact: Contact) {
    await storage.saveContact(contact);
    setContacts((prev) => [...prev, contact]);
  }

  async function deleteContact(userId: string) {
    await storage.deleteContact(userId);
    setContacts((prev) => prev.filter((c) => c.userId !== userId));
  }

  async function addReaction(messageId: string, chatId: string, emoji: string) {
    if (!currentUser) return;
    
    const messages = await storage.getMessages(chatId);
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
    
    const messages = await storage.getMessages(chatId);
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.reactions) return;

    message.reactions = message.reactions.filter(
      (r) => !(r.emoji === emoji && r.userId === currentUser.id)
    );

    await updateMessage(message);
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
        setCurrentUser: setCurrentUserAndSave,
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
      }}
    >
      {children}
    </OpenFlouContext.Provider>
  );
}
