import { Router } from 'express';

import { AuthApi, validateUserSession, handleError } from 'tiny-host-common';
import { DiskApi } from '../lib';

import { Config } from './types';
import db from './db';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  private _authApi: AuthApi;
  public get authApi() { return this._authApi; }

  private _diskApi: DiskApi;
  public get diskApi() { return this._diskApi; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    const validateSession = validateUserSession(db.auth);

    this._authApi = new AuthApi({
      whitelist: config.whitelist,
      handshakeExpTime: config.handshakeExpTime,
      requireScopes: true,
      allowHandshakes: true,
      allowMasterKeys: true,
    }, db.auth, this.router);
    this._diskApi = new DiskApi(config, db.disk, validateSession, this.router, handleError);

    this.router.use(handleError('api'));
  }
}

export default new Api();
