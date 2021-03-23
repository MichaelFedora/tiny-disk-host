import { NextFunction, Request, Response, Router } from 'express';
import { handleError, TinyFileDB, User } from 'tiny-host-common';
export declare class DiskApi {
    private _router;
    get router(): Router;
    constructor(config: {
        storageRoot: string;
        storageMax?: number;
        userStorageMax?: number;
    }, db: TinyFileDB, getUserFromUsername: (username: string) => Promise<User>, sessionValidator: (req: Request, res: Response, next: NextFunction) => void, router?: import("express-serve-static-core").Router, errorHandler?: typeof handleError);
}
