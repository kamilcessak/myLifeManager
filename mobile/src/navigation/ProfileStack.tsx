import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { AccountScreen } from '../screens/main/AccountScreen';
import { PreferencesScreen } from '../screens/main/PreferencesScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Preferences: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () => <WorkspaceSwitcher />,
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{ title: 'Wygląd' }}
      />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Konto i dane' }} />
    </Stack.Navigator>
  );
}
