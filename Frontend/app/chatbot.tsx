import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, MessageCircle, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import { handleUserMessage } from '@/services/git/chatbot-service';

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  loading?: boolean;
}

export default function ChatbotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedRepoId, repositories } = useGit();
  // Use the selected repo, or fall back to the first available one.
  // The chatbot can be opened without navigating to a repo first.
  const effectiveRepoId = selectedRepoId ?? repositories[0]?.id ?? null;
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Storage key is per-repo so each repo has its own chat history
  const storageKey = `gitlane:chat:${effectiveRepoId ?? 'global'}`;

  // Build the welcome message
  const makeWelcome = useCallback((): Message => {
    const repoName = repositories.find(r => r.id === effectiveRepoId)?.name;
    const repoLine = repoName
      ? `Active repo: **${repoName}**`
      : repositories.length === 0
        ? 'No repositories yet — clone or create one first.'
        : 'No repo selected — open a repo to use git queries.';
    return {
      id: 'welcome',
      type: 'bot',
      text:
        `Hey! I'm your Git assistant.\n${repoLine}\n\n` +
        'You can ask me:\n' +
        '• "Show me the latest changes"\n' +
        '• "Find commits by Alice"\n' +
        '• "Search for files named index"\n' +
        '• "Show commits from last week"\n' +
        '• Or just say hello 🙂',
    };
  }, [effectiveRepoId, repositories]);

  // Load saved history (or show welcome) when repo changes
  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    AsyncStorage.getItem(storageKey).then(raw => {
      if (cancelled) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Message[];
          if (saved.length > 0) {
            setMessages(saved);
            setHistoryLoaded(true);
            return;
          }
        } catch { /* corrupted — fall through */ }
      }
      setMessages([makeWelcome()]);
      setHistoryLoaded(true);
    }).catch(() => {
      if (!cancelled) {
        setMessages([makeWelcome()]);
        setHistoryLoaded(true);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist messages whenever they change (skip while loading)
  useEffect(() => {
    if (!historyLoaded) return;
    const real = messages.filter(m => !m.loading);
    // Don't persist welcome-only state
    if (real.length <= 1 && real[0]?.id === 'welcome') return;
    AsyncStorage.setItem(storageKey, JSON.stringify(real)).catch(() => {});
  }, [messages, historyLoaded, storageKey]);

  // Clear chat for this repo
  const handleClearChat = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey).catch(() => {});
    setMessages([makeWelcome()]);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [storageKey, makeWelcome]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate dots for loading state
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 2, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 3, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start();
  }, [dotAnim]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    Keyboard.dismiss();
    scrollToBottom();

    // Show loading state
    setIsLoading(true);
    const loadingMessageId = (Date.now() + 1).toString();
    const loadingMessage: Message = {
      id: loadingMessageId,
      type: 'bot',
      text: '',
      loading: true,
    };
    setMessages(prev => [...prev, loadingMessage]);
    scrollToBottom();

    // Call LLM pipeline: intent → execute → humanize
    let botResponse: string;
    try {
      botResponse = await handleUserMessage(userMessage.text, effectiveRepoId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      botResponse = `Something went wrong: ${msg}`;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Replace loading bubble with real response
    setMessages(prev =>
      prev.map(msg =>
        msg.id === loadingMessageId
          ? { ...msg, text: botResponse, loading: false }
          : msg
      )
    );

    setIsLoading(false);
    scrollToBottom();
  }, [inputText, isLoading, scrollToBottom, effectiveRepoId]);

  const LoadingDots = () => {
    const opacity1 = dotAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [0.4, 1, 0.4, 0.4],
    });
    const opacity2 = dotAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [0.4, 0.4, 1, 0.4],
    });
    const opacity3 = dotAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [0.4, 0.4, 0.4, 1],
    });

    return (
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
        <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
        <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container]}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <ArrowLeft size={22} color={Colors.accentPrimary} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <MessageCircle size={22} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.headerTitle}>Git Assistant</Text>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearChat}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.type === 'user' ? styles.userMessageBubble : styles.botMessageBubble,
            ]}
          >
            {message.loading ? (
              <LoadingDots />
            ) : (
              <Text
                style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userMessageText : styles.botMessageText,
                ]}
              >
                {message.text}
              </Text>
            )}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.inputWrapper, Shadows.md]}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask me anything about Git..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
            onFocus={() => scrollToBottom()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            <Send
              size={18}
              color={inputText.trim() && !isLoading ? '#FFFFFF' : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    minHeight: 60,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimaryDim,
  },
  clearBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.md,
  },
  messageBubble: {
    marginBottom: Spacing.md,
    maxWidth: '85%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  userMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accentPrimary,
  },
  botMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: Colors.textPrimary,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentPrimary,
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
});
