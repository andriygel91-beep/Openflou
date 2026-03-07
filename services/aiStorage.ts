// Openflou AI Messages Storage
import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_MESSAGES_KEY = '@openflou_ai_messages';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Save AI messages
export async function saveAIMessages(messages: AIMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving AI messages:', error);
  }
}

// Load AI messages
export async function loadAIMessages(): Promise<AIMessage[]> {
  try {
    const data = await AsyncStorage.getItem(AI_MESSAGES_KEY);
    if (!data) return [];
    
    const messages = JSON.parse(data);
    return messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Error loading AI messages:', error);
    return [];
  }
}

// Clear AI messages
export async function clearAIMessages(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AI_MESSAGES_KEY);
  } catch (error) {
    console.error('Error clearing AI messages:', error);
  }
}
