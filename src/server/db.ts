import * as level from 'level';
import { LevelUp } from 'levelup';
import { StoreDB } from '../lib';
import { AuthDB } from 'tiny-host-common';

import { Config } from './types';

class DB {

  private _db: LevelUp & { safeGet(key: string): Promise<any> };
  public get db(): LevelUp & { safeGet(key: string): Promise<any> } { return this._db; }

  private _auth: AuthDB;
  public get auth() { return this._auth; }

  private _store: StoreDB;
  public get store() { return this._store; }

  constructor() { }

  init(config: Config) {
    this._db = level(config.dbName, { valueEncoding: 'json' }) as any;
    this._db.safeGet = (key: string) => this._db.get(key).catch(e => { if(e.notFound) return null; else throw e; });
    this._auth = new AuthDB(config, this._db);
    this._store = new StoreDB(this._db, username => this._auth.getUserFromUsername(username));

    /* dump
    this.db.createReadStream({ gt: 'file!!', lt: 'file!"' })
      .on('data', ({ key, value }) => console.log(key, value));
    //*/
  }

  close() { return this.db.close(); }
}

export default new DB();
