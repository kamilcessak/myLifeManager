import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Logowanie' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Rejestracja' }} />
    </Stack.Navigator>
  );
}
