module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/scripts/'],
  // Transform the RN family + @dentvega (ui-kit's dist is ESM; jest runs CJS). `\\.pnpm`
  // keeps pnpm's store path (node_modules/.pnpm/<pkg>/node_modules/<pkg>) from being
  // ignored at its first segment.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm|react-native|@react-native|@react-native-community|@react-navigation|@testing-library|@shopify/flash-list|@dentvega)/)',
  ],
};
