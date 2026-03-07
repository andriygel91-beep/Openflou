// Openflou Type Definitions
export type ThemeType = 'light' | 'dark';
export type Language = 'uk' | 'ru' | 'en';

export interface User {
  id: string;
  username: string;
  password?: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen?: Date;
  publicKey?: string;
  createdAt: Date;
  telegram_username?: string;
  telegram_verified?: boolean;
}

export interface Reaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  encryptedContent?: string;
  type: 'text' | 'photo' | 'video' | 'file' | 'voice';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  timestamp: Date;
  isRead: boolean;
  isEdited: boolean;
  replyTo?: string;
  reactions?: Reaction[];
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel' | 'saved';
  name?: string;
  username?: string;
  avatar?: string;
  participants: string[];
  admins?: string[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  createdAt: Date;
  description?: string;
}

export interface Contact {
  userId: string;
  username: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen?: Date;
  addedAt: Date;
}

export interface AppSettings {
  theme: ThemeType;
  language: Language;
  notifications: boolean;
  messagePreview: boolean;
  vibration: boolean;
  soundEnabled: boolean;
  autoTheme: boolean;
  autoThemeMode: 'system' | 'time';
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  isNewUser: boolean;
}
