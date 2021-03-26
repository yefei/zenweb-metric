'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const async_hooks = require('async_hooks');
const debug = require('debug')('zenweb:metric');

/**
 * @param {import('@zenweb/core').Core} core 
 * @param {*} [options]
 */
function setup(core, options) {
  options = Object.assign({
    logDir: process.env.ZENWEB_METRIC_LOG_DIR || os.tmpdir(),
    logInterval: 60,
    asyncHooks: ['TCPCONNECTWRAP', 'HTTPINCOMINGMESSAGE', 'HTTPCLIENTREQUEST'],
  }, options);
  debug('options: %o', options);

  if (!fs.existsSync(options.logDir)) {
    fs.mkdirSync(options.logDir);
  }

  /**
   * async counter
   * @type { {[key: string]: { active: Set<number>, init: number, destroy: number }} }
   */
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
        // console.log(`${type}(${asyncId})`);
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

  let cpuUsage = process.cpuUsage();
  setInterval(() => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const ymd = `${now.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
    const filename = path.join(options.logDir, `zenweb-app-metric.${ymd}.${os.hostname()}.log`);
    cpuUsage = process.cpuUsage(cpuUsage);
    const mem = process.memoryUsage();
    const loadavg = os.loadavg();
    const data = {
      date: now,
      cpu_user: cpuUsage.user,
      cpu_system: cpuUsage.system,
      mem_rss: mem.rss,
      mem_heap_total: mem.heapTotal,
      mem_heap_used: mem.heapUsed,
      mem_external: mem.external,
      mem_array_buffers: mem.arrayBuffers,
      mem_os_free: os.freemem(),
      loadavg_1: loadavg[0],
      loadavg_5: loadavg[1],
      loadavg_15: loadavg[2],
    };
    for (const [type, counter] of Object.entries(asyncActiveCounter)) {
      data[`async_${type}_init`] = counter.init;
      data[`async_${type}_destroy`] = counter.destroy;
    }
    debug('write log file: %s, %o', filename, data);
    fs.appendFile(filename, JSON.stringify(data) + '\n', 'utf-8', err => {
      if (err) {
        core.log.error('zenweb:metric write log file error: %s', err.message);
      }
    });
  }, options.logInterval * 10);
}

module.exports = {
  setup,
};
