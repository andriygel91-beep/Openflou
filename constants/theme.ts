// Openflou Theme System - Telegram-inspired Design
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
  surfaceSecondary: '#F7F7F7',
  
  // Message Bubbles
  bubbleOut: '#EEFFDE',
  bubbleIn: '#FFFFFF',
  
  // Text
  text: '#000000',
  textSecondary: '#707579',
  textTertiary: '#A0A0A0',
  textInverted: '#FFFFFF',
  
  // Borders & Dividers
  border: '#E0E0E0',
  divider: '#DADCE0',
  
  // Status
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  
  // Online Status
  online: '#4CAF50',
  offline: '#9E9E9E',
  
  // Icons
  icon: '#707579',
  iconActive: '#2481CC',
  
  // Navigation
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E0E0E0',
  
  // Chat specific
  chatBackground: '#D7E4ED',
  messageTime: '#70757999',
  unreadBadge: '#2481CC',
  pinnedBackground: '#F4F4F5',
};

export const darkColors = {
  // Primary
  primary: '#8774E1',
  primaryLight: '#A194E8',
  primaryDark: '#6B5BC7',
  
  // Background
  background: '#0E0E0E',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  
  // Surface
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  
  // Message Bubbles
  bubbleOut: '#8774E1',
  bubbleIn: '#212121',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  textInverted: '#000000',
  
  // Borders & Dividers
  border: '#2C2C2E',
  divider: '#38383A',
  
  // Status
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#64B5F6',
  
  // Online Status
  online: '#4CAF50',
  offline: '#636366',
  
  // Icons
  icon: '#8E8E93',
  iconActive: '#8774E1',
  
  // Navigation
  tabBarBackground: '#1C1C1E',
  tabBarBorder: '#2C2C2E',
  
  // Chat specific
  chatBackground: '#0E0E0E',
  messageTime: '#8E8E93',
  unreadBadge: '#8774E1',
  pinnedBackground: '#2C2C2E',
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
  // Sizes
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  
  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  
  // Line Heights
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
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};
