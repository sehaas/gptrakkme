var HtmlWebpackPlugin = require('html-webpack-plugin');
var webpackConfig = {
	entry: {
		app: './src/index.js'
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist')
    }
	plugins: [
		new CleanWebpackPlugin(['dist']),
		new HtmlWebpackPlugin({
			title: "gptrakkme"
		})
	]
};