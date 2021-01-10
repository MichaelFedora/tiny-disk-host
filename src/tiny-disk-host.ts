import 'source-map-support/register';

import * as express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as fs from 'fs-extra';

import { Config } from './types';
import api from './api';
import db from './db';

let config: Config;
const production = process.env.NODE_ENV === 'production';

try {
  config = fs.readJsonSync('config.json');
} catch(e) {
  console.error(`Couldn't read config.json! ${e.stack || e}`);
  process.exit(1);
}

try {
  db.init(config);
} catch(e) {
  console.error(`Couldn't create database! ${e.stack || e}`);
  process.exit(1);
}

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
  if(err.stack)
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
