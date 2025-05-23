import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { GEMKEY } from "@/constants/keys";
import Anthropic from "@anthropic-ai/sdk";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAddTransaction } from "@/modules/hooks/use-add-transaction";
import { useAddMilestone } from '@/modules/hooks/use-add-milestone';
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Message {
  text: string;
  isUser: boolean;
  data?: any; // optional for storing structured info
}

export default function ChatbotPage() {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      text: t('chatbotWelcome'),
      isUser: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const primaryColor = "#8B5CF6";

  // Update welcome message when language changes
  useEffect(() => {
    setMessages(prev => [{
      text: t('chatbotWelcome'),
      isUser: false,
    }, ...prev.slice(1)]);
  }, [language]);

  const ai = new Anthropic({
    apiKey: "",
  });
  
  const { mutate: addTransaction } = useAddTransaction();
  const { mutate: addMilestone } = useAddMilestone();

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, isUser: true };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      type TextContentBlock = {
        type: "text";
        text: string;
      };

      function isTextBlock(block: any): block is TextContentBlock {
        return block.type === "text" && typeof block.text === "string";
      }

      const response = await ai.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: input,
          },
        ],
        system: `You are a smart financial assistant. You should respond in ${language === 'en' ? 'English' : language === 'gu' ? 'Gujarati' : language === 'mr' ? 'Marathi' : 'Hindi'} language only.

If the user message contains information about saving money or financial goals, respond with a JSON object in this format:
{
  "json": {
    "savedAmount": "<current saved amount or '0'>",
    "goalAmount": "<target amount to save>",
    "duration": "<time period for saving>"
  },
  "message": "<write an encouraging message about their savings goal in ${language === 'en' ? 'English' : language === 'gu' ? 'Gujarati' : language === 'mr' ? 'Marathi' : 'Hindi'} language>"
}

Otherwise, for spending information, respond with this format:
{
  "json": {
    "phoneNumber": "+1234567890",
    "amount": <extract number>,
    "spentCategory": "<extract category>",
    "methodeOfPayment": "<extract payment method or default to 'Cash'>",
    "receiver": "<extract receiver or store name>"
  },
  "message": "<write a friendly confirmation message in ${language === 'en' ? 'English' : language === 'gu' ? 'Gujarati' : language === 'mr' ? 'Marathi' : 'Hindi'} language>"
}`,
      });

      const assistantMessage = response.content
        .filter(isTextBlock)
        .map((block: any) => block.text)
        .join("");
      let message = JSON.parse(assistantMessage);
      
      if (message.message === undefined || "") {
        message.message = language === 'en' 
          ? "I'm sorry, I couldn't understand your request."
          : language === 'gu'
          ? "માફ કરશો, હું તમારી વિનંતી સમજી શક્યો નથી."
          : language === 'mr'
          ? "माफ करा, मला तुमची विनंती समजली नाही."
          : "क्षमा करें, मैं आपका अनुरोध समझ नहीं पाया।";
      }

      if (message.json) {
        if (message.json.savedAmount !== undefined) {
          const milestonePayload = {
            savedAmount: Number(message.json.savedAmount),
            goalAmount: Number(message.json.goalAmount),
            duration: message.json.duration
          };
          addMilestone(milestonePayload);
        } else {
          const transactionPayload = {
            phoneNumber: message.json.phoneNumber || "null",
            amount: message.json.amount || 0,
            spentCategory: message.json.spentCategory || "null",
            methodeOfPayment: message.json.methodeOfPayment || "null",
            receiver: message.json.receiver || "null",
          };
          addTransaction(transactionPayload);
        }
      }

      setMessages((prev) => [
        ...prev,
        { text: message.message, isUser: false, data: message.json },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: language === 'en'
            ? "Sorry, I encountered an error. Please try again."
            : language === 'gu'
            ? "માફ કરશો, એક ભૂલ આવી. કૃપા કરી ફરી પ્રયાસ કરો."
            : language === 'mr'
            ? "क्षमस्व, एक त्रुटी आली. कृपया पुन्हा प्रयत्न करा."
            : "क्षमा करें, एक त्रुटि आई। कृपया पुनः प्रयास करें।",
          isUser: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="robot" size={24} color={primaryColor} />
          <ThemedText style={styles.headerTitle}>{t('chatbotTitle')}</ThemedText>
        </View>

        <ScrollView
          style={styles.messageContainer}
          contentContainerStyle={styles.messageContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageCard,
                message.isUser ? styles.userCard : styles.assistantCard,
              ]}
            >
              {!message.isUser && (
                <View style={styles.assistantHeader}>
                  <MaterialCommunityIcons
                    name="robot"
                    size={20}
                    color={primaryColor}
                  />
                  <ThemedText style={styles.assistantTitle}>Pockit</ThemedText>
                </View>
              )}
              <ThemedText
                style={[
                  styles.messageText,
                  message.isUser ? styles.userText : styles.assistantText,
                ]}
              >
                {message.text}
              </ThemedText>
              {!message.isUser && message.data && (
                <View style={styles.transactionDetails}>
                  {message.data.amount && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="currency-inr" size={16} color={primaryColor} />
                      <ThemedText style={styles.detailText}>
                        Amount: ₹{message.data.amount}
                      </ThemedText>
                    </View>
                  )}
                  {message.data.spentCategory && message.data.spentCategory !== "null" && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="tag" size={16} color={primaryColor} />
                      <ThemedText style={styles.detailText}>
                        Category: {message.data.spentCategory}
                      </ThemedText>
                    </View>
                  )}
                  {message.data.receiver && message.data.receiver !== "null" && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="store" size={16} color={primaryColor} />
                      <ThemedText style={styles.detailText}>
                        Paid to: {message.data.receiver}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={primaryColor} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('chatbotPlaceholder')}
            placeholderTextColor={colorScheme === "dark" ? "#666666" : "#999999"}
            style={[
              styles.input,
              { backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#F3F4F6" },
              { color: colorScheme === "dark" ? "#FFFFFF" : "#000000" },
            ]}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSend}
            style={[styles.sendButton, { opacity: input.trim() ? 1 : 0.5 }]}
            disabled={!input.trim() || isLoading}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    backgroundColor: "#000000",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 8,
  },
  messageContainer: {
    flex: 1,
    padding: 16,
  },
  messageContent: {
    paddingBottom: 20,
  },
  messageCard: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    maxWidth: '90%',
  },
  userCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B5CF6',
  },
  assistantCard: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1E1E',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assistantTitle: {
    marginLeft: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#FFFFFF',
  },
  transactionDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    opacity: 0.9,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: "#333333",
    backgroundColor: "#000000",
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    marginRight: 12,
    padding: 12,
    borderRadius: 16,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
