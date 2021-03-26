import { Core } from '@zenweb/core';

export interface MetricOptions {
  logDir?: string;
  logInterval?: number;
  asyncHooks?: [string],
}

export declare function setup(core: Core, options?: MetricOptions): void;
