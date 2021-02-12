import { NextFunction, Request, Response, Router } from 'express';
import { handleError } from 'tiny-host-common';
import { StoreDB } from './store-db';
export declare class StoreApi {
    private _router;
    get router(): Router;
    constructor(config: {
        storageRoot: string;
        storageMax?: number;
        userStorageMax?: number;
    }, db: StoreDB, sessionValidator: (req: Request, res: Response, next: NextFunction) => void, router?: import("express-serve-static-core").Router, errorHandler?: typeof handleError);
}
