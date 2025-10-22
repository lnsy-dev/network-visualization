require('dotenv').config();

const path = require('path');
const rspack = require('@rspack/core');

module.exports = {
  entry: './index.js',
  mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  output: {
    filename: process.env.OUTPUT_FILE_NAME || 'main.min.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    static: {
      directory: path.join(__dirname),
    },
    compress: true,
    port: process.env.PORT || 3000,
  },
  optimization: {
    minimize: true,
    splitChunks: false,
    runtimeChunk: false,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        mangle: true,
        compress: true,
        format: { comments: false }
      })
    ]
  },
  plugins: [
    new rspack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: false,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  [
                    'cssnano',
                    { preset: ['default', { discardComments: { removeAll: true } }] }
                  ]
                ]
              }
            }
          }
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'ecmascript',
              },
            },
          },
        },
      },
    ],
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
};
