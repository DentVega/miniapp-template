import React from 'react';
import type {MiniappEntryProps} from '@dentvega/miniapp-contract';
import {AppText, Box} from '@dentvega/ui-kit';
import {Screen} from './Screen';

// The capability this miniapp requires. Change it to what your feature needs
// and keep it in sync with manifest.json.
const REQUIRED_CAPABILITY = 'session:whoami';

/**
 * Module Federation exposed entry ("./Entry").
 *
 * Runs inside the host's providers. The host injects a scoped, revocable
 * capability grant — never raw credentials. If the grant is missing or revoked,
 * the miniapp degrades to a permission screen instead of rendering.
 */
export default function Entry({capabilities}: MiniappEntryProps): React.JSX.Element {
  const allowed =
    capabilities.granted.includes(REQUIRED_CAPABILITY) && !capabilities.isRevoked();

  if (!allowed) {
    return (
      <Box padding="xl" gap="sm">
        <AppText variant="title" color="danger" accessibilityRole="header">
          Acceso no autorizado
        </AppText>
        <AppText variant="body" color="textMuted">
          Esta miniapp necesita el permiso “{REQUIRED_CAPABILITY}”.
        </AppText>
      </Box>
    );
  }

  return <Screen />;
}
