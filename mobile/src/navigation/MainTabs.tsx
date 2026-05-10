import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarScreen } from '../screens/main/CalendarScreen';
import { InboxScreen } from '../screens/main/InboxScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

export type MainTabParamList = {
  Inbox: undefined;
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Kalendarz' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
