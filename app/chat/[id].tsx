import React, { useEffect, useEffectEvent, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL, getStoredUser } from '@/api';

export default function ChatDetailScreen() {
  const { id, name } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const CHAT_API = API_BASE_URL.replace('/users', '/chat');

  const fetchMessages = useEffectEvent(async () => {
    try {
      const res = await fetch(`${CHAT_API}/${id}`);
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.log('Mesajlar çekilemedi', e);
    }
  });

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const user = await getStoredUser();
      if (active && user) {
        setCurrentUser(user);
        await fetchMessages();
      }
    };
    void loadData();

    return () => {
      active = false;
    };
  }, [fetchMessages, id]);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      void fetchMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser, fetchMessages, id]);

  const sendMessage = async () => {
    if (inputText.trim() === '' || !currentUser) return;
    
    const newMsg = {
      id: Date.now(),
      content: inputText,
      sender: currentUser,
      timestamp: new Date().toISOString(),
    };
    
    setMessages([...messages, newMsg]);
    setInputText('');

    try {
      await fetch(`${CHAT_API}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circleId: Number(id),
          senderId: currentUser.id,
          content: newMsg.content
        })
      });
      fetchMessages();
    } catch (e) {
      console.log('Mesaj gönderilemedi', e);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        {/* IMPROVED NAVBAR */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={32} color="#8b5cf6" />
          </TouchableOpacity>
          
          <View style={styles.identity}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>{String(name).charAt(0)}</Text>
            </View>
            <View style={styles.titleWrapper}>
              <Text style={styles.headerTitle}>{name}</Text>
              <Text style={styles.statusText}>Aktif</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call-outline" size={24} color="#8b5cf6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoButton}>
            <Ionicons name="videocam-outline" size={26} color="#8b5cf6" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => {
            const isMe = currentUser && item.sender.id === currentUser.id;
            const timeString = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' });
            return (
              <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                {!isMe && <Text style={styles.senderName}>{item.sender.username}</Text>}
                <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
                <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{timeString}</Text>
              </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="add" size={28} color="#8b5cf6" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Mesaj yazın..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={[styles.sendButton, inputText.trim()==='' && styles.sendButtonDisabled]} onPress={sendMessage}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f8' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingVertical: 10, 
    paddingHorizontal: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f1f1' 
  },
  backButton: { padding: 5, marginRight: 5 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarMiniText: { fontSize: 18, fontWeight: '800', color: '#8b5cf6' },
  titleWrapper: { justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  statusText: { fontSize: 12, color: '#8b5cf6', marginTop: 1, fontWeight: '500' },
  callButton: { padding: 10 },
  videoButton: { padding: 10 },
  
  chatList: { padding: 15, paddingBottom: 30 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 20, marginBottom: 12 },
  messageBubbleThem: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 5, shadowColor: '#000', shadowOffset:{width:0, height:1}, shadowOpacity:0.04, shadowRadius:3, elevation:1 },
  messageBubbleMe: { backgroundColor: '#8b5cf6', alignSelf: 'flex-end', borderBottomRightRadius: 5, shadowColor: '#8b5cf6', shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:2 },
  senderName: { fontSize: 12, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  messageText: { fontSize: 16, color: '#333' },
  messageTextMe: { color: '#fff' },
  timeText: { fontSize: 10, color: '#aaa', alignSelf: 'flex-end', marginTop: 5 },
  timeTextMe: { color: '#e0c3fc' },
  
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingHorizontal: 10, 
    paddingVertical: 10, 
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  attachButton: { marginRight: 10, padding: 5 },
  textInput: { 
    flex: 1, 
    backgroundColor: '#f0f0f5', 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, 
    fontSize: 16, 
    color: '#111', 
    maxHeight: 120 
  },
  sendButton: { backgroundColor: '#8b5cf6', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendButtonDisabled: { backgroundColor: '#cfcfcf' }
});
