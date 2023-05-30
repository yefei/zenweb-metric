import * as os from 'os';
import { SetupFunction } from '@zenweb/core';
import { FileBufferStream, FileBufferStreamOption, RootLogger } from 'zenlog.js';

export interface MetricOption extends FileBufferStreamOption {
  /**
   * 日志输出目录
   * @default process.env.LOG_DIR || '/tmp'
   */
  dir?: string;

  /**
   * 日志文件名
   * @default 'zenweb-metric.{yyyy}-{mm}-{dd}.log'
   */
  filename?: string;

  /**
   * 取样间隔(毫秒)
   * @default process.env.ZENWEB_METRIC_SAMPLE_INTERVAL || 10000
   */
  sampleInterval?: number;

  /**
   * apdex 满意值(毫秒内)
   * @default process.env.ZENWEB_METRIC_APDEX_SATISFIED || 100
   */
  apdexSatisfied?: number;
}

const defaultOption: MetricOption = {
  dir: process.env.LOG_DIR,
  filename: 'zenweb-metric.{yyyy}-{mm}-{dd}.log',
  sampleInterval: parseInt(process.env.ZENWEB_METRIC_SAMPLE_INTERVAL || ''),
  apdexSatisfied: parseInt(process.env.ZENWEB_METRIC_APDEX_SATISFIED || ''),
};

export default function setup(opt?: MetricOption): SetupFunction {
  const option = Object.assign({}, defaultOption, opt);
  return function metric(setup) {
    setup.debug('option: %o', option);

    const logger = new RootLogger({
      name: setup.core.name,
      instance: `${os.hostname()}-${process.pid}`,
    });
    logger.addStream(new FileBufferStream(option));

    const cpuCount = os.cpus().length;
    const sampleInterval = option.sampleInterval || 10000;
  
    let lastSampleCpuUsage = process.cpuUsage();
    let lastSampleTime = Date.now();
    let lastRequests = 0;
    let lastRequestsElapsed = 0;
    let lastApdexTolerates = 0;
    let metricRequests = 0;
    let metricRequestsElapsed = 0;
    let metricApdexTolerates = 0;

    function collect() {
      // collect
      const elapsedTime = Date.now() - lastSampleTime;
      const cpuUsage = process.cpuUsage(lastSampleCpuUsage);
      const requests = metricRequests - lastRequests;
      const requests_elapsed = metricRequestsElapsed - lastRequestsElapsed;
      const apdexTolerates = metricApdexTolerates - lastApdexTolerates;
  
      // write
      const mem = process.memoryUsage();
      const data: { [key: string]: any } = {
        timestamp: Math.round(Date.now() / 1000),
        cpu_percentage: (cpuUsage.user + cpuUsage.system) / 1000 / elapsedTime,
        event_delay: Math.max(0, elapsedTime - sampleInterval),
        mem_rss: mem.rss,
        mem_heap_total: mem.heapTotal,
        mem_heap_used: mem.heapUsed,
        mem_external: mem.external,
        mem_array_buffers: mem.arrayBuffers,
        mem_os_free: os.freemem(),
        load_percentage: os.loadavg()[0] / cpuCount,
        active_handles: proceeActiveHandles().length,
      };
      if (requests > 0) {
        data.requests = requests;
        data.requests_elapsed = requests_elapsed;
        data.qps = requests / elapsedTime * 1000;
        data.apdex = ((requests - apdexTolerates) + apdexTolerates * 0.5) / requests;
      }

      // reset
      lastSampleCpuUsage = process.cpuUsage();
      lastSampleTime = Date.now();
      lastRequests = metricRequests;
      lastRequestsElapsed = metricRequestsElapsed;
      lastApdexTolerates = metricApdexTolerates;
  
      setup.debug(data);

      // 写入文件
      logger.record(data);
    }
  
    const timer = setInterval(() => collect(), sampleInterval);

    setup.middleware(async function metricMiddleware(ctx, next) {
      metricRequests++;
      const startTime = Date.now();
      try {
        await next();
      } finally {
        const elapsed = Date.now() - startTime;
        metricRequestsElapsed += elapsed;
        if (elapsed > (option.apdexSatisfied || 100)) {
          metricApdexTolerates++;
        }
      }
    });

    setup.destroy(async () => {
      clearInterval(timer);
      await logger.close();
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
