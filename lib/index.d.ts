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
import { DiskApi } from './disk-api';
import { DiskDB } from './disk-db';
import { FileInfo, FileList, FileListAdvance, Config as DiskConfig } from './types';
export { DiskApi, DiskDB, FileInfo, FileList, FileListAdvance, DiskConfig };
