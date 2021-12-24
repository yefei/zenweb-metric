import '@zenweb/meta';
import fs = require('fs');
import os = require('os');
import path = require('path');
import { SetupFunction } from '@zenweb/core';

export interface MetricOption {
  /**
   * 应用名称
   * @default process.env.npm_package_name || os.hostname()
   */
  name?: string;

  /**
   * 日志输出目录
   * @default process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir()
   */
  logDir?: string;

  /**
   * 日志输出间隔(秒)
   * @default process.env.ZENWEB_METRIC_LOG_INTERVAL || 10
   */
  logInterval?: number;

  /**
   * apdex 超时值(毫秒)
   * @default 100
   */
  apdexSatisfied?: number;

  /**
   * 是否在进程标题中显示
   * @default false
   */
  enableProcessTitle?: boolean;
}

const defaultOption: MetricOption = {
  name: process.env.npm_package_name || os.hostname(),
  logDir: process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir(),
  logInterval: parseInt(process.env.ZENWEB_METRIC_LOG_INTERVAL) || 10,
  apdexSatisfied: 100,
  enableProcessTitle: false,
};

export default function setup(option?: MetricOption): SetupFunction {
  option = Object.assign({}, defaultOption, option);
  // if (options.enableProcessTitle) {
  //   const commandTitleLength = `zenweb: ${option.name} [00000] 100%`.length;
  //   if (process.title.length < commandTitleLength) {
  //     console.warn(`zenweb-metric: enableProcessTitle=true The command line length cannot be less than ${commandTitleLength}`);
  //   }
  // }
  return function metric(setup) {
    setup.debug('option: %o', option);
    setup.checkContextProperty('startTime', '缺少 @zenweb/meta 模块');

    if (!fs.existsSync(option.logDir)) {
      fs.mkdirSync(option.logDir);
    }
  
    const instance = `${os.hostname()}-${process.pid}`;
    const cpuCount = os.cpus().length;
    const sampleInterval = option.logInterval * 1000;
  
    let lastSampleCpuUsage = process.cpuUsage();
    let lastSampleTime = Date.now();
    let lastRequests = 0;
    let lastRequestsElapsed = 0;
    let lastApdexTolerates = 0;
    let metricRequests = 0;
    let metricRequestsElapsed = 0;
    let metricApdexTolerates = 0;
  
    setInterval(() => {
      // collect
      const elapsedTime = Date.now() - lastSampleTime;
      const cpuUsage = process.cpuUsage(lastSampleCpuUsage);
      const requests = metricRequests - lastRequests;
      const requests_elapsed = metricRequestsElapsed - lastRequestsElapsed;
      const apdexTolerates = metricApdexTolerates - lastApdexTolerates;
  
      // write
      const now = new Date();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const ymd = `${now.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
      const filename = path.join(option.logDir, `zenweb-metric.${ymd}.log`);
      const mem = process.memoryUsage();
      const data: { [key: string]: any } = {
        name: option.name,
        instance,
        timestamp: Math.round(now.getTime() / 1000),
        cpu_percentage: (cpuUsage.user + cpuUsage.system) / 1000 / elapsedTime,
        event_delay: Math.max(0, elapsedTime - sampleInterval),
        mem_rss: mem.rss,
        // mem_heap_total: mem.heapTotal,
        // mem_heap_used: mem.heapUsed,
        // mem_external: mem.external,
        // mem_array_buffers: mem.arrayBuffers,
        // mem_os_free: os.freemem(),
        load_percentage: os.loadavg()[0] / cpuCount,
        active_handles: proceeActiveHandles().length,
      };
      if (requests > 0) {
        data.requests = requests;
        data.requests_elapsed = requests_elapsed;
        data.qps = requests / elapsedTime * 1000;
        data.apdex = ((requests - apdexTolerates) + apdexTolerates * 0.5) / requests;
      }
  
      setup.debug('write log: %s, %o', filename, data);
  
      if (option.enableProcessTitle) {
        process.title = `zenweb: ${data.name} [${data.active_handles}] ${data.qps||'-'}/QPS ${data.apdex > 0 ? Math.round(data.apdex * 100) : '-'}%`;
      }
      fs.appendFile(filename, JSON.stringify(data) + '\n', 'utf-8', err => {
        if (err) {
          console.error('zenweb:metric write log error: %s', err.message);
        }
      });
  
      // reset
      lastSampleCpuUsage = process.cpuUsage();
      lastSampleTime = Date.now();
      lastRequests = metricRequests;
      lastRequestsElapsed = metricRequestsElapsed;
      lastApdexTolerates = metricApdexTolerates;
    }, sampleInterval);

    setup.middleware(async function metricMiddleware(ctx, next) {
      metricRequests++;
      try {
        await next();
      } finally {
        const elapsed = Date.now() - ctx.startTime;
        metricRequestsElapsed += elapsed;
        if (elapsed > option.apdexSatisfied) {
          metricApdexTolerates++;
        }
      }
    });
  }
}

/**
 * 修正 typescript 编译错误, _getActiveHandles 为隐藏方法
 */
function proceeActiveHandles(): any[] {
  const p:any = process;
  return p._getActiveHandles();
}