# ZenWeb Metric module

zenweb 健康检测模块，用于生产环境的实例运行信息收集

[ZenWeb](https://www.npmjs.com/package/zenweb)

## 快速使用

安装模块
```bash
$ npm i @zenweb/metric
```

配置模块： 编辑项目启动文件
```ts
// 导入模块
import metric from "@zenweb/metric";
// 安装模块
app.setup(metric(/* 可选配置项 */));
```

## 配置项
| 项 | 值类型 | 默认值 | 说明 |
|----|-------|-------|-----|
| name | `string` | `process.env.npm_package_name \|\| os.hostname()` | 应用名称 |
| logDir | `string` | `process.env.ZENWEB_METRIC_LOG_DIR \|\| os.tmpdir()` | 日志输出目录 |
| logInterval | `number` | `process.env.ZENWEB_METRIC_LOG_INTERVAL \|\| 10` | 日志输出间隔(秒) |
| apdexSatisfied | `number` | `100` | apdex 满意值(毫秒内) |
