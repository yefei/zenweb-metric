import { Core } from '@zenweb/core';

export interface MetricOptions {
  name?: string;
  logDir?: string;
  logInterval?: number;
  apdexSatisfied?: number;
  enableProcessTitle?: boolean;
}

export declare function setup(core: Core, options?: MetricOptions): void;
