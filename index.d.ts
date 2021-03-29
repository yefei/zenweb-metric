import { Core } from '@zenweb/core';

export interface MetricOptions {
  name?: string;
  logDir?: string;
  logInterval?: number;
}

export declare function setup(core: Core, options?: MetricOptions): void;
