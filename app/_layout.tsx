import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

import { getStoredUser } from '@/api';
import { resumeBackgroundTracking, syncPendingLocationQueue } from '@/lib/background-location';
import { addNotificationResponseListener, registerPushDevice } from '@/lib/push';
import { useColorScheme } from '@/hooks/use-color-scheme';

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#6d28d9', backgroundColor: '#ffffff', borderRadius: 18, minHeight: 68 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 13, color: '#4b5563' }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#ef4444', backgroundColor: '#ffffff', borderRadius: 18, minHeight: 68 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 13, color: '#4b5563' }}
    />
  ),
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const subscription = addNotificationResponseListener((route) => {
      if (!mounted) return;
      router.push({ pathname: route.pathname, params: route.params } as never);
    });

    const bootstrapRuntime = async () => {
      try {
        const user = await getStoredUser();
        if (!user) return;
        await syncPendingLocationQueue();
        await resumeBackgroundTracking(user.locationUpdateFrequency ?? 5);
        try {
          await registerPushDevice(user, await syncBackgroundFlag());
        } catch (pushError) {
          console.warn('Push registration skipped:', pushError);
        }
      } catch (error) {
        console.warn('Runtime bootstrap failed:', error);
      }
    };

    bootstrapRuntime();

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName="login" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
          </Stack>
          <StatusBar style="auto" />
          <Toast config={toastConfig} topOffset={54} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

async function syncBackgroundFlag() {
  try {
    const { isBackgroundTrackingEnabled } = await import('@/lib/background-location');
    return isBackgroundTrackingEnabled();
  } catch {
    return false;
  }
}
