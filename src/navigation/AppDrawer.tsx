import React from 'react';
import { Dimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import MainScreen from '@/screens/main/MainScreen';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';

export type AppDrawerParamList = {
  Main: undefined;
};

const Drawer = createDrawerNavigator<AppDrawerParamList>();

export default function AppDrawer() {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: 'front', // slide-over, not push — matches original translateX drawer
        drawerStyle: { width: screenWidth * mobile.drawerWidthPercent },
        overlayColor: `rgba(0,0,0,${mobile.overlayOpacity})`, // #mobileOverlay
        swipeEdgeWidth: 40,
      }}
      drawerContent={() => <SidebarDrawer />}
    >
      <Drawer.Screen name="Main" component={MainScreen} />
    </Drawer.Navigator>
  );
}
