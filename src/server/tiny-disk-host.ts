import 'source-map-support/register';

import * as express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as fs from 'fs-extra';
import * as path from 'path';

import { Config } from './types';

import api from './api';
import db from './db';

let config: Config;
const production = process.env.NODE_ENV === 'production';

try {
  config = fs.readJsonSync('config.json');
} catch(e) {
  console.error(`Couldn't read config.json! ${e instanceof Error ? e.stack : e}`);
  process.exit(1);
}

try {
  db.init(config);
  db.auth.onUserDelete.subscribe(async user => {
    try {
      await db.disk.delFileInfoRecurse('/' + user.id);
      await fs.promises.rm(path.join(config.storageRoot, user.id), { force: true, recursive: true });
    } catch(e) {
      console.error('Error deleting user info!', e);
    }
  });
} catch(e) {
  console.error(`Couldn't create database! ${e instanceof Error ? e.stack : e}`);
  process.exit(1);
}

async function cleanSessions() {
  try {
    await db.auth.cleanSessions();
    await db.auth.cleanHandshakes();
    setTimeout(cleanSessions, 10 * 60 * 1000);
  } catch(e) {
    console.error(`Error cleaning sessions: ${e instanceof Error ? e.stack : e}`);
  }
}
cleanSessions();

try {

  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE' }));
  app.use(helmet());
  app.use(helmet.referrerPolicy({
    policy: 'no-referrer-when-downgrade'
  }));

  app.use(helmet.contentSecurityPolicy({
    directives: production ? {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\''],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:']
    } : {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      scriptSrc: ['\'self\'', '\'unsafe-eval\''],
      imgSrc: ['\'self\'', 'data:']
    }
  }));

  app.use((req, res, next) => {
    const host = req.headers.origin || req.headers.host || req.ip;
    console.log(`${req.method} ${req.hostname}${req.originalUrl} from ${host} (ip: ${req.ip}, ips: [${req.ips}])`);
    next();
  });

  api.init(config);

  app.use('/', api.router);

  app.use(express.static(path.join(__dirname, '../../node_modules/tiny-host-common/dist')));
  app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../../node_modules/tiny-host-common/dist/index.html')));

  app.use((err, req, res, next) => {
    console.error('Express caught an error!', err);
    res.status(500).json({ message: 'Something broke!' });
  });

  console.log('== Initialized! ==');
  console.log(`Listening on ${config.ip}:${config.port}!`);

  app.listen(config.port, config.ip);

} catch(err) {
  console.error('tiny-disk-host.js caught an error!');
  console.error(err);
  if(err instanceof Error)
    console.log(err.stack);
  process.exit(1);
}

process.on('unhandledRejection', err => {
  console.error('**UNHANDLED REJECTION**');
  console.error(err);
});

process.on('exit', () => {
  console.log('Shutting down...');
  db.close().catch(e => {
    if(e) {
      console.error('**ERROR CLOSING DB**');
      console.error(e);
    }
  });
});
