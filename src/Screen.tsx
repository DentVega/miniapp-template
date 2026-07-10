import React from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import {AppText, Box, Card, useTheme} from '@org/ui-kit';

/**
 * Placeholder screen. Replace with your feature.
 * Uses @org/ui-kit primitives so every miniapp shares the design system.
 */
export function Screen(): React.JSX.Element {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.fill, {backgroundColor: theme.colors.background}]}>
      <Box padding="xl" gap="lg" style={styles.fill}>
        <AppText variant="heading" accessibilityRole="header">
          __MINIAPP_NAME__
        </AppText>
        <Card>
          <AppText variant="body" color="textMuted">
            Miniapp generada desde el template. Edita src/Screen.tsx para construir
            tu feature.
          </AppText>
        </Card>
      </Box>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
