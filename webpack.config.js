const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const config = {
	entry: {
		app: './src/index.js'
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/'
	},
	devServer: {
		contentBase: path.resolve(__dirname, 'dist'),
		historyApiFallback: {
			index: '/index.html'
		}
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				]
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				use: ['file-loader']
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			title: "gptrakkme"
		})
	]
};

if (process.env.SKIP_CLEAN !== 'true') {
	config.plugins.push(
		new CleanWebpackPlugin(['dist'])
	);
}
if (process.env.NODE_ENV !== 'FIXME_production') {
	config.plugins.push(
		new CopyWebpackPlugin([
			{
				from: 'test_data',
				to: 'data'
			}
		])
	);
}

module.exports = config;