import * as path from 'path';
import { pbkdf2, randomBytes } from 'crypto';
import { json, Router, static as staticServe } from 'express';
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
  }
}

export default new Api();
