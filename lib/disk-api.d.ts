import { NextFunction, Request, Response, Router } from 'express';
import { handleError } from 'tiny-host-common';
import { DiskDB } from './disk-db';
export declare class DiskApi {
    private _router;
    get router(): Router;
    constructor(config: {
        storageRoot: string;
        storageMax?: number;
        userStorageMax?: number;
    }, db: DiskDB, sessionValidator: (req: Request, res: Response, next: NextFunction) => void, router?: import("express-serve-static-core").Router, errorHandler?: typeof handleError);
}
