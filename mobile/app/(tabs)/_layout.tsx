import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Market: '🏪',
    Sell: '📷',
    Orders: '📦',
    Dashboard: '📊',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#374151',
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#9ca3af',
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Market',
          tabBarIcon: ({ focused }) => <TabIcon label="Market" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: ({ focused }) => <TabIcon label="Sell" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon label="Orders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
