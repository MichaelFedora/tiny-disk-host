import * as path from 'path';
import { randomBytes } from 'crypto';
import { json, Router } from 'express';
import * as fs from 'fs-extra';

import { AuthError, MalformedError, NotAllowedError } from './errors';
import { Config, User } from './types';
import { handleError, handleValidationError, parseTrue, validateSession, wrapAsync } from './middleware';
import { hash, sizeOf } from './util';

import db from './db';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    // auth

    const authRouter = Router();

    authRouter.post('/login', json(), wrapAsync(async (req, res) => {
      if(config.whitelist && !config.whitelist.includes(req.body.username))
        throw new AuthError('Whitelist is active.');

      if(!req.body.scopes || !(req.body.scopes instanceof Array))
        throw new AuthError('Must provide scope(s)!');

      const user = await db.getUserFromUsername(req.body.username);
      if(!user)
        throw new AuthError('Username / password mismatch.');

      const pass = await hash(user.salt, req.body.password);
      if(user.pass !== pass)
        throw new AuthError('Username / password mismatch.');

      res.send(await db.addSession(user.id, req.body.scopes ));
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

    authRouter.post('/change-pass', validateSession(), json(), wrapAsync(async (req, res) => {
      if(!req.body.password || !req.body.newpass)
        throw new MalformedError('Body must have a password, and a newpass.');

      if(await hash(req.user.salt, req.body.password) !== req.user.pass)
        throw new NotAllowedError('Password mismatch.');

      const salt = randomBytes(128).toString('hex');
      const pass = hash(salt, req.body.newpass);

      await db.putUser(req.user.id, Object.assign(req.user, { salt, pass }));
      const sessions = await db.getSessionsForUser(req.user.id);
      await db.delManySessions(sessions.filter(a => a !== req.session.id));
    }));

    authRouter.post('/logout', validateSession(), wrapAsync(async (req, res) => {
      await db.delSession(req.session.id);
      res.sendStatus(204);
    }));

    authRouter.get('/refresh', validateSession(), wrapAsync(async (req, res) => {
      const sess = await db.addSession(req.user.id, req.session.scopes);
      await db.delSession(req.session.id);
      res.json(sess);
    }));

    this.router.use('/auth', authRouter);
    this.router.delete('/self', validateSession(), wrapAsync(async (req, res) => {
      if(req.user) {
        await db.delUser(req.user.id);
        await db.delFileInfoRecurse('/' + req.user.id);
        await new Promise<void>((res, rej) =>
          fs.rm(path.join(config.storageRoot, req.user.id), { recursive: true, maxRetries: 3 },
          (e) => e ? rej(e) : res())
        );
      }
      res.sendStatus(204);
    }));

    // files

    const filesRouter = Router({ mergeParams: true });

    filesRouter.use('/:path', validateSession(), (req, _, next) => {
      const rootPath = path.join(config.storageRoot, req.user.id);
      const filePath = path.join(rootPath, req.params.path);

      if(!filePath.startsWith(rootPath) || filePath.length - 1 < rootPath.length)
        throw new NotAllowedError('Malformed path!');

      const infoPath = path.join('/' + req.user.id, req.params.path);

      if(!req.session.scopes.find(scope => infoPath.startsWith(scope)))
        throw new NotAllowedError('Path out of scope(s)!');

      req.params.infoPath = infoPath;
      req.params.filePath = filePath;
      next();
    });

    filesRouter.get('/:path', wrapAsync(async (req, res) => {
      if(parseTrue(req.query.info))
        res.json(await db.getFileInfo(req.params.infoPath));
      else
        res.sendFile(req.params.filePath);
    }));

    filesRouter.put('/:path', wrapAsync(async (req, res) => {
      const length = Number(req.headers['content-length'] || req.headers['Content-Length']) || 0;

      if(config.storageMax) {
        const size = await sizeOf(config.storageRoot) + length;
        if(size > config.storageMax)
          throw new NotAllowedError('Storage max reached.');
      }

      if(config.userStorageMax) {
        const size = await sizeOf(path.join(config.storageRoot, req.user.id)) + length;
        if(size > config.userStorageMax)
          throw new NotAllowedError('User storage max reached.');
      }

      await fs.writeFile(req.params.filePath, req.body);
      const stat = await fs.stat(req.params.path);

      await db.setFileInfo(req.params.infoPath, {
        name: path.parse(req.params.filePath).name,
        size: stat.size,
        modified: Date.now(),
        type: String(req.headers['content-type'] || req.headers['Content-Type'] || '') || undefined
      });

      res.sendStatus(204);
    }));

    filesRouter.delete('/:path', wrapAsync(async (req, res) => {
      await fs.remove(req.params.filePath);
      await db.delFileInfo(req.params.infoPath);
      res.sendStatus(204);
    }));

    this.router.use('/files', filesRouter, handleError('files'));

    // list-files

    this.router.get('/list-files', validateSession(), wrapAsync(async (req, res) => {
      if(req.session.scopes.includes('/'))
        throw new NotAllowedError('Can only list-files root if scope is global ("/")!');

      const dirPath = '/' + req.user.id;
      const page = Number(req.query.page) || 0;

      if(parseTrue(req.query.advance))
        res.json(await db.listFilesAdvance(dirPath, page))
      else
        res.json(await db.listFiles(dirPath, page))
    }), handleError('list-files-global'));

    this.router.get('/list-files/:path', validateSession(), wrapAsync(async (req, res) => {
      const rootPath = '/' + req.user.id;
      const dirPath = path.join(req.user.id, req.params.path);

      if(!dirPath.startsWith(rootPath) || dirPath.length - 1 < rootPath.length)
        throw new NotAllowedError('Malformed path!');

      if(!req.session.scopes.find(scope => dirPath.startsWith(scope)))
        throw new NotAllowedError('Path out of scope!');

      const page = Number(req.query.page) || 0;

      if(parseTrue(req.query.advance))
        res.json(await db.listFilesAdvance(dirPath, page))
      else
        res.json(await db.listFiles(dirPath, page))
    }), handleError('list-files-path'));

    this.router.get('/storage-stats', validateSession(), wrapAsync(async (req, res) => {
      const used = await sizeOf(path.join(config.storageRoot, req.user.id));
      let max = -1;

      if(config.storageMax) {
        const currentUsed = await sizeOf(path.join(config.storageRoot));

        max = config.storageMax - currentUsed + used;

        if(config.userStorageMax)
          max = Math.min(max, config.userStorageMax);

      } else if(config.userStorageMax)
        max = config.userStorageMax

      res.json({ used, available: max > 0 ? max - used : -1, max });
    }))

    this.router.get('/:user/public/:path', wrapAsync(async (req, res) => {
      const rootPath = path.join(config.storageRoot, req.params.user, 'public');
      const filePath = path.join(rootPath, req.params.path);

      if(!filePath.startsWith(rootPath) || filePath.length - 1 < rootPath.length)
        throw new NotAllowedError('Malformed path!');

      /* const infoPath = path.join('/' + req.params.user, req.params.path);

      if(parseTrue(req.query.info))
        res.json(await db.getFileInfo(infoPath));
      else */
        res.sendFile(filePath);
    }));

    this.router.use(handleError('api'));
  }
}

export default new Api();
