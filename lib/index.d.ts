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
import StoreApi from './store-api';
import { StoreDB } from './store-db';
import { FileInfo, FileList, FileListAdvance, Config as StoreConfig } from './types';
export { StoreApi, StoreDB, FileInfo, FileList, FileListAdvance, StoreConfig };
