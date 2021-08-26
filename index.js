'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const debug = require('debug')('zenweb:metric');

function hrtime2ms(time) {
  return time[0] * 1e3 + time[1] * 1e-6;
}

function getMetricMiddleware(core, options) {
  return async function metricMiddleware(ctx, next) {
    core._metricRequests++;
    ctx._metricStartTime = process.hrtime();
    try {
      await next();
    } finally {
      const elapsed = hrtime2ms(process.hrtime(ctx._metricStartTime));
      core._metricRequestsElapsed += elapsed;
      if (elapsed > options.apdexSatisfied) {
        core._metricApdexTolerates++;
      }
    }
  };
}

/**
 * @param {import('@zenweb/core').Core} core 
 * @param {*} [options]
 */
function setup(core, options) {
  options = Object.assign({
    name: process.env.npm_package_name || os.hostname(),
    logDir: process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir(),
    logInterval: parseInt(process.env.ZENWEB_METRIC_LOG_INTERVAL) || 10,
    apdexSatisfied: 100,
    enableProcessTitle: false, // 是否显示在进程标题中
  }, options);
  debug('options: %o', options);

  // if (options.enableProcessTitle) {
  //   const commandTitleLength = `zenweb: ${options.name} [00000] 100%`.length;
  //   if (process.title.length < commandTitleLength) {
  //     console.warn(`zenweb-metric: enableProcessTitle=true The command line length cannot be less than ${commandTitleLength}`);
  //   }
  // }

  core._metricRequests = 0;
  core._metricRequestsElapsed = 0;
  core._metricApdexTolerates = 0;

  core.koa.use(getMetricMiddleware(core, options));

  if (!fs.existsSync(options.logDir)) {
    fs.mkdirSync(options.logDir);
  }

  const instance = `${os.hostname()}-${process.pid}`;
  const cpuCount = os.cpus().length;
  const sampleInterval = options.logInterval * 1000;

  let lastSampleCpuUsage = process.cpuUsage();
  let lastSampleTime = process.hrtime();
  let lastRequests = 0;
  let lastRequestsElapsed = 0;
  let lastApdexTolerates = 0;

  setInterval(() => {
    // collect
    const elapsedTime = hrtime2ms(process.hrtime(lastSampleTime));
    const cpuUsage = process.cpuUsage(lastSampleCpuUsage);
    const requests = core._metricRequests - lastRequests;
    const requests_elapsed = core._metricRequestsElapsed - lastRequestsElapsed;
    const apdexTolerates = core._metricApdexTolerates - lastApdexTolerates;

    // reset
    lastSampleCpuUsage = process.cpuUsage();
    lastSampleTime = process.hrtime();
    lastRequests = core._metricRequests;
    lastRequestsElapsed = core._metricRequestsElapsed;
    lastApdexTolerates = core._metricApdexTolerates;

    // write
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const ymd = `${now.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
    const filename = path.join(options.logDir, `zenweb-metric.${ymd}.log`);
    const mem = process.memoryUsage();
    const data = {
      name: options.name,
      instance,
      timestamp: Math.round(now / 1000),
      cpu_percentage: (cpuUsage.user + cpuUsage.system) / 1000 / elapsedTime,
      event_delay: Math.max(0, elapsedTime - sampleInterval),
      mem_rss: mem.rss,
      mem_heap_total: mem.heapTotal,
      mem_heap_used: mem.heapUsed,
      mem_external: mem.external,
      mem_array_buffers: mem.arrayBuffers,
      mem_os_free: os.freemem(),
      load_percentage: os.loadavg()[0] / cpuCount,
      active_handles: process._getActiveHandles().length,
      requests,
      requests_elapsed,
      apdex: requests ? ((requests - apdexTolerates) + apdexTolerates * 0.5) / requests : -1,
    };
    debug('write log: %s, %o', filename, data);
    if (options.enableProcessTitle) {
      process.title = `zenweb: ${data.name} [${data.active_handles}] ${data.apdex > 0 ? Math.round(data.apdex * 100) : '-'}%`;
    }
    fs.appendFile(filename, JSON.stringify(data) + '\n', 'utf-8', err => {
      if (err) {
        core.log.error('zenweb:metric write log error: %s', err.message);
      }
    });
  }, sampleInterval);
}

module.exports = {
  setup,
};
