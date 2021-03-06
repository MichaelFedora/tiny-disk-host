import * as level from 'level';
import { LevelUp } from 'levelup';
import { AuthDB } from 'tiny-host-common';
import { DiskDB } from '../lib';

import { Config } from './types';

class DB {

  private _db: LevelUp & { safeGet(key: string): Promise<any> };
  public get db(): LevelUp & { safeGet(key: string): Promise<any> } { return this._db; }

  private _auth: AuthDB;
  public get auth() { return this._auth; }

  private _disk: DiskDB;
  public get disk() { return this._disk; }

  constructor() { }

  init(config: Config) {
    this._db = level(config.dbName, { valueEncoding: 'json' }) as any;
    this._db.safeGet = (key: string) => this._db.get(key).catch(e => { if(e.notFound) return null; else throw e; });
    this._auth = new AuthDB(config, this._db);
    this._disk = new DiskDB(this._db, username => this._auth.getUserFromUsername(username));

    /* dump
    this.db.createReadStream({ gt: 'file!!', lt: 'file!"' })
      .on('data', ({ key, value }) => console.log(key, value));
    //*/
  }

  close() { return this.db.close(); }
}

export default new DB();
