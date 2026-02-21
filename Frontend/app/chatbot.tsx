import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  loading?: boolean;
}

const FAKE_RESPONSES = [
  'That\'s a great question! Let me help you with that.',
  'Based on your query, here\'s what I found...',
  'Interesting! Here are some suggestions for you.',
  'I understand. Let me provide you with the details.',
  'Perfect timing! Here\'s what you need to know.',
];

export default function ChatbotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      text: 'Hey! I\'m your Git assistant. Ask me anything about repositories, branches, commits, or anything else git-related!',
    },
  ]);
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

    // Simulate API call with 2-3 second delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Replace loading message with actual response
    const randomResponse = FAKE_RESPONSES[Math.floor(Math.random() * FAKE_RESPONSES.length)];
    const botResponse = `${randomResponse}\n\nYou asked: "${inputText.trim()}"\n\nThis is a simulated response from your Git assistant. In a real implementation, this would be connected to an actual AI chatbot service.`;

    setMessages(prev =>
      prev.map(msg =>
        msg.id === loadingMessageId
          ? { ...msg, text: botResponse, loading: false }
          : msg
      )
    );

    setIsLoading(false);
    scrollToBottom();
  }, [inputText, isLoading, scrollToBottom]);

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
        <View style={{ width: 40 }} />
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
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
