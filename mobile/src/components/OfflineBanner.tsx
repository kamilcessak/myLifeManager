import { useNetInfo } from '@react-native-community/netinfo';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppThemeProvider';

export function OfflineBanner() {
  const { colors } = useAppTheme();
  const net = useNetInfo();
  const insets = useSafeAreaInsets();

  const offline = net.isConnected === false;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          backgroundColor: colors.offlineBannerBg,
          paddingBottom: 8,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        text: {
          color: colors.offlineBannerText,
          fontWeight: '600',
          fontSize: 14,
        },
      }),
    [colors.offlineBannerBg, colors.offlineBannerText],
  );

  if (!offline) return null;

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.text}>Tryb offline — pokazuję ostatnio zsynchronizowane dane</Text>
    </View>
  );
}
