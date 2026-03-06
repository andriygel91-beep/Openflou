// Openflou Message Search Screen
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { MaterialIcons } from '@expo/vector-icons';
import { Message } from '@/types';
import * as storage from '@/services/storage';
import { StatusBar } from 'expo-status-bar';

interface SearchResult {
  message: Message;
  chatName: string;
  chatId: string;
}

export default function SearchMessagesScreen() {
  const { colors, t, chats, theme } = useOpenFlou();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];

    for (const chat of chats) {
      const messages = await storage.getMessages(chat.id);
      const matchedMessages = messages.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );

      for (const message of matchedMessages) {
        results.push({
          message,
          chatName: chat.name || 'Unknown',
          chatId: chat.id,
        });
      }
    }

    results.sort((a, b) =>
      new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime()
    );

    setSearchResults(results);
    setIsSearching(false);
  }

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } else if (isYesterday) {
      return t.yesterday;
    } else {
      return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialIcons name="search" size={20} color={colors.icon} />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t.searchMessages}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={20} color={colors.icon} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      {searchQuery.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search" size={64} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.searchMessages}</Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={64} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.noResults}</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.message.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/chat?id=${item.chatId}`)}
              style={({ pressed }) => [
                styles.resultItem,
                {
                  backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={[styles.chatName, { color: colors.primary }]}>{item.chatName}</Text>
                <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                  {formatTime(item.message.timestamp)}
                </Text>
              </View>
              <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={2}>
                {item.message.content}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    includeFontPadding: false,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
  timeText: {
    fontSize: 12,
    includeFontPadding: false,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
