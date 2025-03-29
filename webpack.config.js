import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  entry: {
    service_worker: './extension/service_worker.ts',
    browserAction: './extension/browserAction.ts',
    options: './extension/options.ts',
    offscreen: './extension/offscreen.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'extension/manifest.json', to: 'manifest.json' },
        { from: 'extension/*.html', to: '[name][ext]' },
        { from: 'extension/images', to: 'images' },
        { from: 'extension/libs', to: 'libs' },
      ],
    }),
  ],
}; 