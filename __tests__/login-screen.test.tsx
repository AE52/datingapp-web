import React from 'react';
import { render, screen } from '@testing-library/react-native';

import LoginScreen from '@/app/login';

jest.mock('@/api', () => ({
  getStoredUser: jest.fn(async () => null),
  login: jest.fn(async () => undefined),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
}));

describe('LoginScreen', () => {
  it('does not prefill or advertise the demo account by default', () => {
    render(<LoginScreen />);

    expect(screen.getAllByText('Giriş Yap').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('E-Posta Adresi').props.value).toBe('');
    expect(screen.getByPlaceholderText('Parola').props.value).toBe('');
    expect(screen.queryByText(/demo hesap/i)).toBeNull();
  });
});
