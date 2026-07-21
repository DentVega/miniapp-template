import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Repack from '@callstack/repack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Re.Pack config for the `__MINIAPP_ID__` federated remote.
 * Exposes "./Entry"; the host resolves + mounts it on demand.
 * `shared` singletons must stay compatible with what the host provides.
 */
export default Repack.defineRspackConfig({
  context: __dirname,
  entry: './src/Entry.tsx',
  resolve: {
    ...Repack.getResolveOptions(),
  },
  module: {
    rules: [
      {
        test: /\.[cm]?[jt]sx?$/,
        type: 'javascript/auto',
        use: {
          loader: '@callstack/repack/babel-swc-loader',
          parallel: true,
          options: {},
        },
      },
      ...Repack.getAssetTransformRules(),
    ],
  },
  plugins: [
    new Repack.RepackPlugin(),
    new Repack.plugins.ModuleFederationPluginV2({
      name: '__MINIAPP_ID__',
      filename: '__MINIAPP_ID__.container.js.bundle',
      exposes: {
        './Entry': './src/Entry.tsx',
      },
      shared: {
        react: { singleton: true, eager: false, requiredVersion: '18.3.1' },
        'react-native': { singleton: true, eager: false, requiredVersion: '0.76.6' },
        '@dentvega/ui-kit': { singleton: false, requiredVersion: '^0.1.0' },
      },
    }),
  ],
});
