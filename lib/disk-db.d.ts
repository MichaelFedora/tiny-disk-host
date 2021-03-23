import { LevelUp } from 'levelup';
import { FileInfo, FileList, FileListAdvance, TinyFileDB } from 'tiny-host-common';
export declare class DiskDB implements TinyFileDB {
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
