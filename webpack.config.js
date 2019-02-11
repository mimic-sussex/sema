module.exports = {
  // entry: './test/test.web.js',
  mode: 'development',
  entry: {
      app: './src/main.js'
  },
  output: {
    path: __dirname + '/build',
    publicPath: '/build/',
    filename: 'bundle.js'
  }

}
