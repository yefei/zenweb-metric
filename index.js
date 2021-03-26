'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const debug = require('debug')('zenweb:metric');

function hrtime2ms(time) {
  return time[0] * 1e3 + time[1] * 1e-6;
}

/**
 * @param {import('@zenweb/core').Core} core 
 * @param {*} [options]
 */
function setup(core, options) {
  options = Object.assign({
    logDir: process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir(),
    logInterval: parseInt(process.env.ZENWEB_METRIC_LOG_INTERVAL) || 10,
    // asyncHooks: ['TCPCONNECTWRAP', 'HTTPINCOMINGMESSAGE', 'HTTPCLIENTREQUEST'],
  }, options);
  debug('options: %o', options);

  if (!fs.existsSync(options.logDir)) {
    fs.mkdirSync(options.logDir);
  }

  /*
   * async counter
   * @type { {[key: string]: { active: Set<number>, init: number, destroy: number }} }
   */
  /*
  const asyncActiveCounter = {};
  if (options.asyncHooks && options.asyncHooks.length) {
    options.asyncHooks.forEach(type => {
      asyncActiveCounter[type] = {
        active: new Set(),
        init: 0,
        destroy: 0,
      };
    });
    async_hooks.createHook({
      init(asyncId, type, triggerAsyncId, resource) {
        if (type in asyncActiveCounter) {
          asyncActiveCounter[type].active.add(asyncId);
          asyncActiveCounter[type].init++;
        }
        console.log(`${type}(${asyncId})`);
      },
      destroy(asyncId) {
        for (const counter of Object.values(asyncActiveCounter)) {
          if (counter.active.has(asyncId)) {
            counter.active.delete(asyncId);
            counter.destroy++;
            break;
          }
        }
      }
    }).enable();
  }
  */

  const sampleInterval = options.logInterval * 1000;
  let lastSampleCpuUsage = process.cpuUsage();
  let lastSampleTime = process.hrtime();

  setInterval(() => {
    // collect
    const elapsedTime = hrtime2ms(process.hrtime(lastSampleTime));
    const cpuUsage = process.cpuUsage(lastSampleCpuUsage);

    // reset
    lastSampleCpuUsage = process.cpuUsage();
    lastSampleTime = process.hrtime();

    // write
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const ymd = `${now.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
    const filename = path.join(options.logDir, `zenweb-metric.${ymd}.${os.hostname()}.log`);
    const mem = process.memoryUsage();
    const loadavg = os.loadavg();
    const data = {
      timestamp: Math.round(now / 1000),
      cpu_percentage: (cpuUsage.user + cpuUsage.system) / 1000 / elapsedTime,
      event_delay: Math.max(0, elapsedTime - sampleInterval),
      mem_rss: mem.rss,
      mem_heap_total: mem.heapTotal,
      mem_heap_used: mem.heapUsed,
      mem_external: mem.external,
      mem_array_buffers: mem.arrayBuffers,
      mem_os_free: os.freemem(),
      loadavg_1: loadavg[0],
      loadavg_5: loadavg[1],
      loadavg_15: loadavg[2],
      active_handles: process._getActiveHandles().length,
    };
    // for (const [type, counter] of Object.entries(asyncActiveCounter)) {
    //   data[`async_${type}_init`] = counter.init;
    //   data[`async_${type}_destroy`] = counter.destroy;
    // }
    debug('write log: %s, %o', filename, data);
    fs.appendFile(filename, JSON.stringify(data) + '\n', 'utf-8', err => {
      if (err) {
        core.log.error('zenweb:metric write log file error: %s', err.message);
      }
    });
  }, sampleInterval);
}

module.exports = {
  setup,
};
