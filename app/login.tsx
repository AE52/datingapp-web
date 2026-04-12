import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, fetchWithTimeout } from '@/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('eren@example.com');
  const [password, setPassword] = useState('1234');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const user = await AsyncStorage.getItem('user');
      if (user) router.replace('/(tabs)');
    };
    checkLogin();
  }, []);

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }, 5000);
      if (response.ok) {
        const user = await response.json();
        await AsyncStorage.setItem('user', JSON.stringify(user));
        router.replace('/(tabs)');
      } else {
        Alert.alert('Giriş Başarısız', 'Geçersiz e-posta. İpucu: eren@example.com');
      }
    } catch (e: any) {
      Alert.alert('Bağlantı Hatası', `Sunucuya bağlanılamadı.\nURL: ${API_BASE_URL}\nHata: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#6d28d9', '#4c1d95']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>📍</Text>
        </View>
        <Text style={styles.title}>VibeApp</Text>
        <Text style={styles.subtitle}>Sevdiklerinle daima bağlantıda kal</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Giriş Yap</Text>
        <TextInput
          style={styles.input}
          placeholder="E-Posta Adresi"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Parola"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.loginButtonText}>{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>💡 eren@example.com / 1234</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoIcon: { fontSize: 48 },
  title: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  form: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40 },
  formTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 20 },
  input: { backgroundColor: '#f2f2f7', padding: 16, borderRadius: 14, marginBottom: 14, fontSize: 16, color: '#111' },
  loginButton: { backgroundColor: '#6d28d9', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 16 },
});
