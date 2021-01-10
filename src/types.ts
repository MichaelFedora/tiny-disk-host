export interface FileInfo {
  name: string;
  size: number;
  modified: number;
  type?: string;
}

export interface FileList {
  entries: string[];
  page?: number;
}

export interface FileListAdvance {
  entries: { [path: string]: FileInfo };
  page?: number;
}

export interface Session {
  id?: string;
  user: string;
  scopes: string[];
  created: number;
}

export interface User {
  id?: string;
  username: string;
  pass: string;
  salt: string;
}

export interface Config {
  ip: string;
  port: number;

  sessionExpTime: number;
  whitelist?: string[];

  dbName: string;
  storageRoot: string;
}
