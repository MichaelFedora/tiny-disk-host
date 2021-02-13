import { AuthConfig } from 'tiny-host-common';
import { DiskConfig } from '../lib';

export interface Config extends DiskConfig, AuthConfig {
  ip: string;
  port: number;

  dbName: string;
}
