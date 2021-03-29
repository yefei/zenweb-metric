# ZenWeb Metric module

[ZenWeb](https://www.npmjs.com/package/zenweb)

config:
```js
{
  name: process.env.npm_package_name || os.hostname(),
  logDir: process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir(),
  logInterval: 60, // s
  apdexSatisfied: 100, // ms
}
```
