import * as http from 'http';
import { Core } from '@zenweb/core';
import router from '@zenweb/router';
import metric from '../src/index';

const app = module.exports = new Core();
app.setup(metric());
app.setup(router());
app.setup(function test() {
  app.router.get('/', ctx => {
    ctx.body = 'aaa';
  });
  app.router.get('/req', ctx => {
    http.request('http://httpbin.org/get', res => {
      console.log('res', res.headers);
    }).end();
    ctx.body = 'bbb';
  });
});
app.start();
