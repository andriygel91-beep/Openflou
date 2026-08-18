// Openflou Theme System — Refined Design
export const lightColors = {
  // Primary
  primary: '#2481CC',
  primaryLight: '#4A9DE5',
  primaryDark: '#1B6BA8',

  // Background
  background: '#FFFFFF',
  backgroundSecondary: '#F4F4F5',
  backgroundTertiary: '#E8E8E8',

  // Surface
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F2F7',

  // Message Bubbles
  bubbleOut: '#DCEFB7',
  bubbleIn: '#FFFFFF',
  bubbleOutText: '#000000',
  bubbleInText: '#000000',

  // Text
  text: '#000000',
  textSecondary: '#60666B',
  textTertiary: '#A8AAAD',
  textInverted: '#FFFFFF',

  // Borders & Dividers
  border: '#E5E5EA',
  divider: '#D1D1D6',

  // Status
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#2481CC',

  // Online Status
  online: '#34C759',
  offline: '#AEAEB2',

  // Icons
  icon: '#8E8E93',
  iconActive: '#2481CC',

  // Navigation
  tabBarBackground: '#F8F8F8',
  tabBarBorder: '#E5E5EA',

  // Chat specific
  chatBackground: '#DAE9F5',
  messageTime: '#8E8E93',
  unreadBadge: '#2481CC',
  pinnedBackground: '#F2F2F7',
};

export const darkColors = {
  // Primary — warmer blue-violet, less harsh
  primary: '#5E9CF5',
  primaryLight: '#7BB3FF',
  primaryDark: '#4A7FD4',

  // Background — true dark, Telegram-like
  background: '#17212B',
  backgroundSecondary: '#0E1621',
  backgroundTertiary: '#242F3D',

  // Surface — card surfaces slightly lighter
  surface: '#1C2733',
  surfaceSecondary: '#242F3D',

  // Message Bubbles
  bubbleOut: '#2B5278',
  bubbleIn: '#182533',
  bubbleOutText: '#FFFFFF',
  bubbleInText: '#FFFFFF',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9DAAB6',
  textTertiary: '#6B7D8C',
  textInverted: '#17212B',

  // Borders & Dividers
  border: '#2A3A4A',
  divider: '#243040',

  // Status
  success: '#34C759',
  error: '#FF453A',
  warning: '#FF9F0A',
  info: '#5E9CF5',

  // Online Status
  online: '#34C759',
  offline: '#6B7D8C',

  // Icons
  icon: '#8BAFC4',
  iconActive: '#5E9CF5',

  // Navigation
  tabBarBackground: '#1C2733',
  tabBarBorder: '#2A3A4A',

  // Chat specific
  chatBackground: '#0E1621',
  messageTime: '#8BAFC4',
  unreadBadge: '#5E9CF5',
  pinnedBackground: '#242F3D',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  lineHeightTight: 1.2,
  lineHeightNormal: 1.4,
  lineHeightRelaxed: 1.6,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};
