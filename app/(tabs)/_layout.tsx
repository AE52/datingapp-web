import { Tabs, router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { getStoredUser } from '@/api';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const u = await getStoredUser();
      if (u) {
        if (u.admin) {
          setIsAdmin(true);
        }
      }
    };
    checkRole();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#8e8e93',
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e5ea',
          backgroundColor: '#fff',
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Konum',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="driving"
        options={{
          title: 'Sürüş',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'car' : 'car-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: 'Güvenlik',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          title: 'Planlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'star' : 'star-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* chat folder: görünmez sekme ama tab bar her zaman gösterilir */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      {/* places: görünmez sekme */}
      <Tabs.Screen
        name="places"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      {/* call: görünmez sekme */}
      <Tabs.Screen
        name="call"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      {/* history: görünmez sekme */}
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
