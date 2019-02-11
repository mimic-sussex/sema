module.exports = {
  // entry: './test/test.web.js',
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: __dirname + '/build',
    publicPath: '/build/',
    filename: 'bundle.js'
  }

}
