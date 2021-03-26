'use strict';

const http = require('http');

process.env.DEBUG = '*';

const app = module.exports = require('zenweb').create();
app.setup(require('..').setup);
app.boot().then(() => {
  app.router.get('/', ctx => {
    http.request('http://httpbin.org/get', res => {
      console.log('res', res.headers);
    }).end();
    ctx.body = 'aaa';
  });
  app.listen();
});
