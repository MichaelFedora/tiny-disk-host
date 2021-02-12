import { Router } from 'express';

import { AuthApi, validateUserSession, handleError } from 'tiny-host-common';
import { StoreApi } from '../lib';

import { Config } from './types';
import db from './db';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  private _authApi: AuthApi;
  public get authApi() { return this._authApi; }

  private _storeApi: StoreApi;
  public get storeApi() { return this._storeApi; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    const validateSession = validateUserSession(db.auth);

    this._authApi = new AuthApi(config, db.auth, this.router);
    this._storeApi = new StoreApi(config, db.store, validateSession, this.router, handleError);

    this.router.use(handleError('api'));
  }
}

export default new Api();
