import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { API_BASE_URL, getStoredUser } from '@/api';

export default function ChatListScreen() {
  const [circles, setCircles] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await getStoredUser();
      if (u) {
        setCurrentUser(u);
        fetchCircles(u.id);
      }
    };
    loadUser();
  }, []);

  const fetchCircles = async (userId: number) => {
    try {
      const URL = API_BASE_URL.replace('/users', '/circles');
      const res = await fetch(`${URL}/user/${userId}`);
      const data = await res.json();
      setCircles(data);
    } catch (e) {
      console.log('Gruplar çekilemedi', e);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        {/* PREMIUM NAVBAR */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sohbetler</Text>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="create-outline" size={26} color="#8b5cf6" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={circles}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.chatCard}
              onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name)}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={styles.chatBody}>
                <Text style={styles.chatTitle}>{item.name}</Text>
                <Text style={styles.chatSubtitle} numberOfLines={1}>{item.members?.length || 0} Üye • Son mesaja gitmek için dokun</Text>
              </View>
              <View style={styles.rightSection}>
                <Ionicons name="chevron-forward" size={20} color="#c0c0c0" />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8fb' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#fff', 
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f1f1',
    // Removed messy manual paddings for seamless native SafeArea
  },
  iconButton: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  list: { padding: 0, paddingTop: 10 },
  chatCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 15, 
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8fb'
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#8b5cf6' },
  chatBody: { flex: 1, marginLeft: 15 },
  chatTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  chatSubtitle: { fontSize: 14, color: '#888' },
  rightSection: { paddingLeft: 10 }
});
