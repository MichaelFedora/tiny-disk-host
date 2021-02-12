import { NextFunction, Request, Response } from 'express';
import { handleError } from 'tiny-host-common';
import { StoreDB } from './store-db';
declare class StoreApi {
    init(config: {
        storageRoot: string;
        storageMax?: number;
        userStorageMax?: number;
    }, db: StoreDB, sessionValidator: (req: Request, res: Response, next: NextFunction) => void, router?: import("express-serve-static-core").Router, errorHandler?: typeof handleError): import("express-serve-static-core").Router;
}
declare const _default: StoreApi;
export default _default;
