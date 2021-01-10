import * as level from 'level';
import { LevelUp } from 'levelup';
import { v4 } from 'uuid';

import { Config, FileInfo, FileList, Session, User, FileListAdvance } from './types';

class DB {

  private sessionExpTime = 604800000;

  private _db: LevelUp & { safeGet(key: string): Promise<any> };
  public get db(): LevelUp & { safeGet(key: string): Promise<any> } { return this._db; }

  constructor() { }

  init(config: Config) {
    this._db = level(config.dbName, { valueEncoding: 'json' }) as any;
    this._db.safeGet = (key: string) => this._db.get(key).catch(e => { if(e.notFound) return null; else throw e; });
    this.sessionExpTime = config.sessionExpTime;
  }

  close() { return this.db.close(); }

  // auth

  async addSession(user: string, scopes = ['/']): Promise<string> {
    let id: string;
    do {
      id = v4();
    } while(await this.getSession(id) != null);
    await this.db.put('session!!' + id, { user, created: Date.now(), scopes });
    return id;
  }

  async getSession(session: string): Promise<Session> {
    const s = await this.db.safeGet('session!!' + session);
    if(s) s.id = session;
    return s;
  }

  async delSession(session: string): Promise<void> {
    return await this.db.del('session!!' + session);
  }

  async cleanSessions(): Promise<void> {
    const sessions: string[] = [];
    const start = 'session!!';
    const end = 'session!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: Session }) => {
        if((value.created + this.sessionExpTime) > Date.now())
          sessions.push(key);
      }).on('close', () => res());
    });
    let batch = this.db.batch();
    for(const sess of sessions)
      batch = batch.del(sess);
    await batch.write();
  }

  async addUser(user: User): Promise<string> {
    delete user.id;

    let id: string;
    do {
      id = v4();
    } while(await this.getUser(id) != null);
    await this.db.put('user!!' + id, user);
    return id;
  }

  async putUser(id: string, user: User): Promise<void> {
    delete user.id;

    await this.db.put('user!!' + id, user);
  }

  async getUser(id: string): Promise<User> {
    const u = await this.db.safeGet('user!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delUser(id: string): Promise<void> {
    return await this.db.del('user!!' + id);
  }

  async getUserFromUsername(username: string): Promise<User> {
    let user: User = null;
    let destroyed = false;
    const start = 'user!!';
    const end = 'user!"'
    await new Promise<void>(res => {
      const stream = this.db.createValueStream({ gt: start, lt: end });
      stream.on('data', (value: User) => {
        if(!destroyed && value.username === username) {
          destroyed = true;
          user = value;
          (stream as any).destroy();
        }
      }).on('close', () => res());
    });
    return user;
  }

  // files

  async getFileInfo(path: string): Promise<FileInfo> {
    return await this.db.safeGet('file!!' + path);
  }
  async setFileInfo(path: string, data: FileInfo): Promise<void> {
    await this.db.put('file!!' + path, data);
  }
  async delFileInfo(path: string): Promise<void> {
    await this.db.del('file!!' + path);
  }

  async listFiles(path: string, page = 0): Promise<FileList> {
    const entries: string[] = [];
    let count = 0;
    let destroyed = false;
    const start = 'file!!' + path;
    const end = 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
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
    const start = 'file!!' + path;
    const end = 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
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

export default new DB();
