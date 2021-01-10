import { Request } from 'express-serve-static-core';

declare module 'express' {
  interface Request {
    user?: import('./types').User;
    session: import('./types').Session;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: import('./types').User;
    session: import('./types').Session;
  }
}
