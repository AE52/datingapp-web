import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

const AppMap = forwardRef(({ children, style }: any, ref: any) => {
  
  // Mock methods so Web doesn't crash if called
  useImperativeHandle(ref, () => ({
    animateToRegion: () => { console.log('Animated on Web (Simulated)'); }
  }));

  return (
    <View style={style || styles.container}>
       <Text style={styles.text}>Harita Web Sürümünde Gösterilmez</Text>
       <Text style={styles.subText}>Lütfen Pinleri ve Animasyonları Görmek İçin Mobil (iOS/Android) Cihaz veya Simülatör Kullanın.</Text>
       {/* Simulate markers rendering loosely on web */}
       {children}
    </View>
  );
});
AppMap.displayName = 'AppMap';

export const AppMarker = ({ children, onPress }: any) => {
   return (
     <Pressable style={styles.marker} onPress={onPress}>
       {children}
     </Pressable>
   );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e6efe9', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#999', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#aaa', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  marker: { position: 'absolute' } // Simplified for mock
});

export default AppMap;
