'use strict';

process.env.DEBUG = '*';

const http = require('http');
const { Core } = require('@zenweb/core');
const { default: router } = require('@zenweb/router');
const { default: meta } = require('@zenweb/meta');
const { default: metric } = require('../dist/index');

const app = module.exports = new Core();
app.setup(meta());
app.setup(metric());
app.setup(router());
app.boot().then(() => {
  app.router.get('/', ctx => {
    ctx.body = 'aaa';
  });
  app.router.get('/req', ctx => {
    http.request('http://httpbin.org/get', res => {
      console.log('res', res.headers);
    }).end();
    ctx.body = 'bbb';
  });
  app.listen();
});
