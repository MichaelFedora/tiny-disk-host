import * as path from 'path';
import { pbkdf2, randomBytes } from 'crypto';
import { json, Router } from 'express';
import * as fs from 'fs-extra';

import { AuthError, MalformedError, NotAllowedError } from './errors';
import { Config, User } from './types';
import { handleError, handleValidationError, parseTrue, validateSession, wrapAsync } from './middleware';

import db from './db';

async function hash(salt: string, password: string) {
  return new Promise<string>((res, rej) => {
    pbkdf2(password, salt, 10000, 512, 'sha256', (err, data) => {
      if(err)
        return rej(err);
      else
        return res(data.toString('hex'));
    });
  });
}

class Api {

  private _router: Router;
  public get router() { return this._router; }

  constructor() {
    this._router = Router();
    this.router.use(handleError('api'));
  }

  init(config: Config) {

    // auth

    const authRouter = Router();

    authRouter.post('/login', json(), wrapAsync(async (req, res) => {
      if(config.whitelist && !config.whitelist.includes(req.body.username))
        throw new AuthError('Whitelist is active.');

      const user = await db.getUserFromUsername(req.body.username);
      if(!user)
        throw new AuthError('Username / password mismatch.');

      const pass = await hash(user.salt, req.body.password);
      if(user.pass !== pass)
        throw new AuthError('Username / password mismatch.');

      res.send(await db.addSession(user.id, req.body.scope || '/'));
    }), handleValidationError);

    authRouter.use(handleError('auth'));

    authRouter.post('/register', json(), wrapAsync(async (req, res) => {
      if(!req.body.username || !req.body.password)
        throw new MalformedError('Must have a username and password!');

      if(config.whitelist && !config.whitelist.includes(req.body.username))
        throw new NotAllowedError('Whitelist is active.');

      if(await db.getUserFromUsername(req.body.username))
        throw new NotAllowedError('Username taken!');

      const salt = randomBytes(128).toString('hex');
      const user: User = {
        username: req.body.username,
        salt,
        pass: await hash(salt, req.body.password)
      };

      await db.addUser(user);
      res.sendStatus(204);
    }));

    authRouter.post('/logout', validateSession(), wrapAsync(async (req, res) => {
      await db.delSession(req.session.id);
      res.sendStatus(204);
    }));

    authRouter.get('/refresh', validateSession(), wrapAsync(async (req, res) => {
      const sess = await db.addSession(req.user.id, req.session.scope);
      await db.delSession(req.session.id);
      res.json(sess);
    }));

    this.router.use('/auth', authRouter);

    // files

    const filesRouter = Router({ mergeParams: true });

    filesRouter.get('/:path', wrapAsync(async (req, res) => {
      if(parseTrue(req.query.info))
        res.json(await db.getFileInfo(req.params.filePath));
      else
        res.sendFile(req.params.filePath);
    }));

    filesRouter.use('/:path', validateSession(), (req, _, next) => {
      const rootPath = path.join(config.storageRoot, req.params.namespace);
      const filePath = path.join(rootPath, req.params.path);

      if(!filePath.startsWith(rootPath) || filePath.length - 1 < rootPath.length)
        throw new NotAllowedError('Malformed path!');

      if(!filePath.startsWith(req.session.scope))
        throw new NotAllowedError('Path out of scope!');

      req.params.filePath = filePath;
      next();
    });

    filesRouter.put('/:path', wrapAsync(async (req, res) => {
      await fs.writeFile(req.params.filePath, req.body);
      const stat = await fs.stat(req.params.path);
      await db.setFileInfo(req.params.filePath, {
        name: path.parse(req.params.filePath).name,
        size: stat.size,
        modified: Date.now(),
        type: String(req.headers['content-type'] || req.headers['Content-Type'] || '') || undefined
      });
      res.sendStatus(204);
    }));

    filesRouter.delete('/:path', wrapAsync(async (req, res) => {
      await fs.remove(req.params.filePath);
      await db.delFileInfo(req.params.filePath);
      res.sendStatus(204);
    }));

    this.router.use('/:namespace/files/', filesRouter, handleError('files'));

    // list-files

    this.router.get('/:namespace/list-files', validateSession(), wrapAsync(async (req, res) => {
      if(req.session.scope !== '/')
        throw new NotAllowedError('Can only list root file if scope is global!');

      const namespace = req.params.namespace;
      const page = Number(req.query.page) || 0;

      if(parseTrue(req.query.advance))
        res.json(await db.listFilesAdvance(namespace, page))
      else
        res.json(await db.listFiles(namespace, page))
    }), handleError('list-files-global'));

    this.router.get('/:namespace/list-files/:path', validateSession(), wrapAsync(async (req, res) => {
      const rootPath = path.normalize(req.params.namespace);
      const dirPath = path.join(req.params.namespace, req.params.path);

      if(!dirPath.startsWith(rootPath) || dirPath.length - 1 < rootPath.length)
        throw new NotAllowedError('Malformed path!');

      if(!dirPath.startsWith(req.session.scope))
        throw new NotAllowedError('Path out of scope!');

      const page = Number(req.query.page) || 0;

      if(parseTrue(req.query.advance))
        res.json(await db.listFilesAdvance(dirPath, page))
      else
        res.json(await db.listFiles(dirPath, page))
    }), handleError('list-files-path'));
  }
}

export default new Api();
