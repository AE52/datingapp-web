import React, { forwardRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';

const AppMap = forwardRef(({ children, initialRegion, style }: any, ref: any) => {
  return (
    <MapView ref={ref} style={style || styles.mapBackground} initialRegion={initialRegion}>
      {children}
    </MapView>
  );
});
AppMap.displayName = 'AppMap';

export const AppMarker = ({ children, coordinate, onPress }: any) => {
  return (
    <Marker coordinate={coordinate} onPress={onPress}>
      {children}
    </Marker>
  );
}

const styles = StyleSheet.create({
  mapBackground: { ...StyleSheet.absoluteFillObject }
});

export default AppMap;
