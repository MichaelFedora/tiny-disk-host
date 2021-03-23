declare module 'express' {
    interface Request {
        filesParams?: any;
    }
}
declare module 'express-serve-static-core' {
    interface Request {
        filesParams?: any;
    }
}
export { DiskApi } from './disk-api';
export { DiskDB } from './disk-db';
export { Config as DiskConfig } from './types';
export { FileInfo, FileList, FileListAdvance } from 'tiny-host-common';
