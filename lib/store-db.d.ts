import { LevelUp } from 'levelup';
import { FileInfo, FileList, FileListAdvance } from './types';
export declare class StoreDB {
    private _db;
    getUserFromUsername: (username: string) => Promise<{
        id?: string;
    }>;
    private scope;
    get db(): LevelUp;
    safeGet(key: string): Promise<any>;
    constructor(_db: LevelUp, getUserFromUsername: (username: string) => Promise<{
        id?: string;
    }>, scope?: string);
    getFileInfo(path: string): Promise<FileInfo>;
    setFileInfo(path: string, data: FileInfo): Promise<void>;
    delFileInfo(path: string): Promise<void>;
    delFileInfoRecurse(path: string): Promise<void>;
    listFiles(path: string, page?: number): Promise<FileList>;
    listFilesAdvance(path: string, page?: number): Promise<FileListAdvance>;
}
