import { LevelUp } from 'levelup';

import { FileInfo, FileList, FileListAdvance } from './types';

export class StoreDB {

  public get db(): LevelUp { return this._db; }

  public async safeGet(key: string) { return this.db.get(key).catch(e => { if(e.notFound) return null; else throw e; }); }

  constructor(private _db: LevelUp, public getUserFromUsername: (username: string) => Promise<{ id?: string }>, private scope = '') {
    if(scope && !scope.endsWith('!!'))
      this.scope = scope + '!!';
  }

  // files

  async getFileInfo(path: string): Promise<FileInfo> {
    return await this.safeGet(this.scope + 'file!!' + path);
  }
  async setFileInfo(path: string, data: FileInfo): Promise<void> {
    await this.db.put(this.scope + 'file!!' + path, data);
  }
  async delFileInfo(path: string): Promise<void> {
    await this.db.del(this.scope + 'file!!' + path);
  }
  async delFileInfoRecurse(path: string): Promise<void> {
    const start = this.scope + 'file!!' + path;
    const end = this.scope + 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
    let batch = this.db.batch();
    await new Promise<any>(res => {
      const stream = this.db.createKeyStream({ gt: start, lt: end });
      stream.on('data', (key: string) => batch.del(key))
        .on('close', () => res(batch.write()));
    });
  }

  async listFiles(path: string, page = 0): Promise<FileList> {
    const entries: string[] = [];
    let count = 0;
    let destroyed = false;
    const start = this.scope + 'file!!' + path;
    const end = this.scope + 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
    await new Promise<void>(res => {
      const stream = this.db.createKeyStream({ gt: start, lt: end });
      stream.on('data', (key: string) => {
        count++;
        if(count >= (page * 100) && count <= ((page + 1) * 100)) {
          entries.push(key.slice(start.length))
        } else if(!destroyed) {
          destroyed = true;
          (stream as any).destroy();
        }
      }).on('close', () => res());
    });

    const ret: FileList = { entries };
    if(count > ((page + 1) * 100))
      ret.page = page + 1;

    return ret;
  }

  async listFilesAdvance(path: string, page = 0): Promise<FileListAdvance> {
    const entries: { [path: string]: FileInfo } = { };
    let count = 0;
    let destroyed = false;
    const start = this.scope + 'file!!' + path;
    const end = this.scope + 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: FileInfo }) => {
        count++;
        if(count >= (page * 100) && count <= ((page + 1) * 100)) {
          entries[key.slice(start.length)] = value;
        } else if(!destroyed) {
          destroyed = true;
          (stream as any).destroy();
        }
      }).on('close', () => res());
    });

    const ret: FileListAdvance = { entries };
    if(count > (page + 1) * 100)
      ret.page = page + 1;

    return ret;
  }
}
