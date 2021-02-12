"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreDB = void 0;
class StoreDB {
    constructor(_db, getUserFromUsername) {
        this._db = _db;
        this.getUserFromUsername = getUserFromUsername;
    }
    get db() { return this._db; }
    async safeGet(key) { return this.db.get(key).catch(e => { if (e.notFound)
        return null;
    else
        throw e; }); }
    // files
    async getFileInfo(path) {
        return await this.safeGet('file!!' + path);
    }
    async setFileInfo(path, data) {
        await this.db.put('file!!' + path, data);
    }
    async delFileInfo(path) {
        await this.db.del('file!!' + path);
    }
    async delFileInfoRecurse(path) {
        const start = 'file!!' + path;
        const end = 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
        let batch = this.db.batch();
        await new Promise(res => {
            const stream = this.db.createKeyStream({ gt: start, lt: end });
            stream.on('data', (key) => batch.del(key))
                .on('close', () => res(batch.write()));
        });
    }
    async listFiles(path, page = 0) {
        const entries = [];
        let count = 0;
        let destroyed = false;
        const start = 'file!!' + path;
        const end = 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
        await new Promise(res => {
            const stream = this.db.createKeyStream({ gt: start, lt: end });
            stream.on('data', (key) => {
                count++;
                if (count >= (page * 100) && count <= ((page + 1) * 100)) {
                    entries.push(key.slice(start.length));
                }
                else if (!destroyed) {
                    destroyed = true;
                    stream.destroy();
                }
            }).on('close', () => res());
        });
        const ret = { entries };
        if (count > ((page + 1) * 100))
            ret.page = page + 1;
        return ret;
    }
    async listFilesAdvance(path, page = 0) {
        const entries = {};
        let count = 0;
        let destroyed = false;
        const start = 'file!!' + path;
        const end = 'file!!' + path.slice(0, path.length - 1) + String.fromCharCode(path.charCodeAt(path.length - 1) + 1);
        await new Promise(res => {
            const stream = this.db.createReadStream({ gt: start, lt: end });
            stream.on('data', ({ key, value }) => {
                count++;
                if (count >= (page * 100) && count <= ((page + 1) * 100)) {
                    entries[key.slice(start.length)] = value;
                }
                else if (!destroyed) {
                    destroyed = true;
                    stream.destroy();
                }
            }).on('close', () => res());
        });
        const ret = { entries };
        if (count > (page + 1) * 100)
            ret.page = page + 1;
        return ret;
    }
}
exports.StoreDB = StoreDB;
