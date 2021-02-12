import { AuthConfig } from 'tiny-host-common';
import { StoreConfig } from '../lib';

export interface Config extends StoreConfig, AuthConfig {
  ip: string;
  port: number;

  dbName: string;
}
