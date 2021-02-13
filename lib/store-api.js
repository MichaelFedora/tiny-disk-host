"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreApi = void 0;
const path = require("path");
const express_1 = require("express");
const fs = require("fs-extra");
const mime = require("mime-types");
const tiny_host_common_1 = require("tiny-host-common");
const util_1 = require("./util");
class StoreApi {
    constructor(config, db, sessionValidator, router = express_1.Router(), errorHandler = tiny_host_common_1.handleError) {
        this._router = router;
        const filesRouter = express_1.Router({ mergeParams: true });
        const parsePath = (req, _, next) => {
            req.filesParams = {};
            req.filesParams.path = req.params[0];
            const rootPath = path.resolve(config.storageRoot, req.user.id);
            const filePath = path.join(rootPath, req.params[0]);
            if (!filePath.startsWith(rootPath) || filePath.length - 1 < rootPath.length)
                return next(new tiny_host_common_1.NotAllowedError('Malformed path!'));
            const infoPath = path.join('/' + req.user.id, req.params[0]).replace(/\\/g, '/');
            if (!req.session.scopes.find(scope => req.params[0].startsWith(scope.slice(1))))
                return next(new tiny_host_common_1.NotAllowedError('Path out of scope(s)!'));
            req.filesParams.infoPath = infoPath;
            req.filesParams.filePath = filePath;
            next();
        };
        filesRouter.get(new RegExp(`/${util_1.PATH_REGEX}`), parsePath, tiny_host_common_1.wrapAsync(async (req, res) => {
            if (util_1.parseTrue(req.query.info))
                res.json(await db.getFileInfo(req.filesParams.infoPath));
            else
                res.sendFile(req.filesParams.filePath);
        }));
        filesRouter.put(new RegExp(`/${util_1.PATH_REGEX}`), parsePath, tiny_host_common_1.wrapAsync(async (req, res) => {
            const length = Number(req.headers['content-length'] || req.headers['Content-Length']) || 0;
            if (config.storageMax) {
                const size = await util_1.sizeOf(config.storageRoot) + length;
                if (size > config.storageMax)
                    throw new tiny_host_common_1.NotAllowedError('Storage max reached.');
            }
            if (config.userStorageMax) {
                const size = await util_1.sizeOf(path.join(config.storageRoot, req.user.id)) + length;
                if (size > config.userStorageMax)
                    throw new tiny_host_common_1.NotAllowedError('User storage max reached.');
            }
            fs.ensureFileSync(req.filesParams.filePath);
            if (req.body) {
                await fs.writeFile(req.filesParams.filePath, req.body);
            }
            else {
                await new Promise((res, rej) => {
                    req.pipe(fs.createWriteStream(req.filesParams.filePath, { mode: 0o600 }))
                        .on('close', res)
                        .on('error', rej);
                });
            }
            const stat = await fs.stat(req.filesParams.filePath);
            const parsed = path.parse(req.filesParams.filePath);
            const header = req.headers['content-type'] || req.headers['Content-Type'];
            const type = String(req.query.contentType || mime.lookup(parsed.ext) || (header !== 'application/x-www-form-urlencoded' ? header : '') || 'application/octet-stream');
            await db.setFileInfo(req.filesParams.infoPath, {
                name: parsed.base,
                size: stat.size,
                modified: Date.now(),
                type
            });
            res.sendStatus(204);
        }));
        filesRouter.delete(new RegExp(`/${util_1.PATH_REGEX}`), parsePath, tiny_host_common_1.wrapAsync(async (req, res) => {
            if (!await fs.access(req.filesParams.filePath).then(() => true, () => false))
                throw new tiny_host_common_1.NotFoundError('Could not find file, or do not have access.');
            await fs.remove(req.filesParams.filePath);
            await db.delFileInfo(req.filesParams.infoPath);
            // get all folders, minus user folder & file
            const folders = req.filesParams.filePath.slice(path.resolve(config.storageRoot).length).split(/[\/\\]+/g).filter(a => Boolean(a)).slice(0, -1);
            for (let i = 0; i < folders.length; i++) {
                const dir = path.join(config.storageRoot, folders.slice(0, folders.length - i).join('/'));
                const size = await util_1.sizeOf(dir);
                if (!size)
                    await fs.rmdir(dir);
                else
                    break;
            }
            res.sendStatus(204);
        }));
        router.use('/files', sessionValidator, filesRouter, errorHandler('files'));
        // list-files
        router.get('/list-files', sessionValidator, tiny_host_common_1.wrapAsync(async (req, res) => {
            if (!req.session.scopes.includes('/'))
                throw new tiny_host_common_1.NotAllowedError('Can only list-files root if scope is global ("/")!');
            const dirPath = '/' + req.user.id;
            const page = Number(req.query.page) || 0;
            if (util_1.parseTrue(req.query.advance))
                res.json(await db.listFilesAdvance(dirPath, page));
            else
                res.json(await db.listFiles(dirPath, page));
        }), errorHandler('list-files-global'));
        router.get(new RegExp(`/list-files/${util_1.PATH_REGEX}`), sessionValidator, tiny_host_common_1.wrapAsync(async (req, res) => {
            req.params.path = req.params[0];
            const dirPath = '/' + req.user.id + '/' + req.params.path;
            if (!req.session.scopes.find(scope => req.params.path.startsWith(scope.slice(1))))
                throw new tiny_host_common_1.NotAllowedError('Path out of scope!');
            const page = Number(req.query.page) || 0;
            if (util_1.parseTrue(req.query.advance))
                res.json(await db.listFilesAdvance(dirPath, page));
            else
                res.json(await db.listFiles(dirPath, page));
        }), errorHandler('list-files-path'));
        router.get('/storage-stats', sessionValidator, tiny_host_common_1.wrapAsync(async (req, res) => {
            const used = await util_1.sizeOf(path.join(config.storageRoot, req.user.id));
            let max = -1;
            if (config.storageMax) {
                const currentUsed = await util_1.sizeOf(path.join(config.storageRoot));
                max = config.storageMax - currentUsed + used;
                if (config.userStorageMax)
                    max = Math.min(max, config.userStorageMax);
            }
            else if (config.userStorageMax)
                max = config.userStorageMax;
            res.json({ used, available: max > 0 ? max - used : -1, max });
        }));
        router.get(new RegExp(`/public/([^/]+)/${util_1.PATH_REGEX}`), tiny_host_common_1.wrapAsync(async (req, res) => {
            const userName = req.params[0];
            const user = await db.getUserFromUsername(userName);
            if (!user)
                throw new tiny_host_common_1.NotFoundError('User not found with username "' + userName + '"!');
            const ppath = req.params[1];
            const rootPath = path.resolve(config.storageRoot, user.id, 'public');
            const filePath = path.join(rootPath, ppath);
            if (!filePath.startsWith(rootPath) || filePath.length - 1 < rootPath.length)
                throw new tiny_host_common_1.NotAllowedError('Malformed path!');
            const infoPath = '/' + user.id + '/public/' + req.params.path;
            if (util_1.parseTrue(req.query.info))
                res.json(await db.getFileInfo(infoPath));
            else
                res.sendFile(filePath);
        }));
        router.post(new RegExp(`/public-info/([^/]+)`), express_1.json(), tiny_host_common_1.wrapAsync(async (req, res) => {
            const userName = req.params[0];
            const user = await db.getUserFromUsername(userName);
            if (!user)
                throw new tiny_host_common_1.NotFoundError('User not found with username "' + userName + '"!');
            const paths = req.body;
            if (!(paths instanceof Array && typeof paths[0] === 'string'))
                throw new tiny_host_common_1.MalformedError('Body must be a string[]!');
            const rootInfoPath = '/' + user.id + '/public';
            const infoTree = {};
            for (const path of paths)
                infoTree[path] = await db.getFileInfo(rootInfoPath + path);
            res.json(infoTree);
        }));
    }
    get router() { return this._router; }
}
exports.StoreApi = StoreApi;
