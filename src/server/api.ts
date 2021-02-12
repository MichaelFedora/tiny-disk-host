import * as path from 'path';
import { Router } from 'express';
import * as fs from 'fs-extra';

import { Config } from './types';
import db from './db';

import { StoreApi } from '../lib';

import { AuthApi, validateUserSession, User, handleError } from 'tiny-host-common';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    const onUserDelete = async (user: User) => {
      try {
        await db.store.delFileInfoRecurse('/' + user.id);
        await fs.promises.rm(path.join(config.storageRoot, user.id), { force: true, recursive: true });
      } catch(e) {
        console.error('Error deleting user info!', e); // should I re-throw?
      }
    };

    const validateSession = validateUserSession(db.auth);

    AuthApi.init(config, db.auth, onUserDelete, this.router);
    StoreApi.init(config, db.store, validateSession, this.router, handleError);

    this.router.use(handleError('api'));
  }
}

export default new Api();
