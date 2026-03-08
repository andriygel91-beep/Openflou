// Openflou Type Definitions
export type ThemeType = 'light' | 'dark';
export type Language = 'uk' | 'ru' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'pl' | 'tr' | 'ar' | 'zh' | 'ja' | 'ko' | 'hi';

export interface User {
  id: string;
  username: string; // Unique, lowercase identifier
  display_name?: string; // Display name (can be changed)
  password?: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen?: Date;
  publicKey?: string;
  createdAt: Date;
  telegram_username?: string;
  telegram_verified?: boolean;
  telegram_chat_id?: number;
  // Signal Protocol E2EE
  identityPublicKey?: string;
  identityPrivateKey?: string;
  registrationId?: number;
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
  // E2EE fields
  iv?: string; // Initialization Vector for AES-GCM
  // Disappearing messages
  expiresAt?: Date;
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel' | 'saved';
  name?: string;
  username?: string;
  avatar?: string;
  participants: string[];
  admins?: string[];
  creatorId?: string; // Original creator (can transfer ownership)
  bannedUsers?: string[]; // Banned user IDs
  pinnedMessageId?: string; // Pinned message ID
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  createdAt: Date;
  description?: string;
  // Disappearing messages
  disappearingMessagesEnabled?: boolean;
  disappearingMessagesTimer?: number; // seconds
}

export interface Contact {
  userId: string;
  username: string;
  displayName?: string;
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
