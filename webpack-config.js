require('dotenv').config();
var path = require('path');
var webpack = require('webpack');
var nodeExternals = require('webpack-node-externals');
var CopyWebpackPlugin = require('copy-webpack-plugin');

var plugins = [
    new webpack.NoErrorsPlugin(),
    new webpack.BannerPlugin('require("source-map-support").install();',
        {raw: true, entryOnly: false}),
    new CopyWebpackPlugin(
        [
            {
                from: path.resolve(__dirname, 'src/migrator/migrations'),
                to: 'migrations'
            }
        ],
        {ignore: ['*.ts']}
    )
];

if (process.env.DFWB_DEV !== '1') {
    plugins.push(
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
            compress: {drop_console: true, drop_debugger: true, warnings: false}
        })
    );
}

module.exports = {
    resolve: {
        root: path.resolve(__dirname, 'src'),
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".js"]
    },
    entry: [path.resolve(__dirname, 'src/bootstrap.ts')],
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'bundle.js'
    },
    module: {
        loaders: [
            {test: /\.json$/, loader: 'json'},
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'babel-loader?cacheDirectory!ts-loader'
            }
        ]
    },
    ts: {
        ignoreDiagnostics: [7019]
    },
    plugins: plugins,
    target: 'node',
    externals: [nodeExternals()],
    node: {__dirname: true, __filename: true}
};
