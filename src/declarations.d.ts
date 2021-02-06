import { Request } from 'express-serve-static-core';

declare module 'express' {
  interface Request {
    filesParams?: any;
    user?: import('./types').User;
    session: import('./types').Session;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    filesParams?: any;
    user?: import('./types').User;
    session: import('./types').Session;
  }
}
