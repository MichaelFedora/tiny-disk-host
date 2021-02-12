"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamToBuffer = exports.sizeOf = exports.PATH_REGEX = exports.parseTrue = void 0;
const path = require("path");
const fs = require("fs-extra");
var middleware_1 = require("tiny-host-common/lib/middleware");
Object.defineProperty(exports, "parseTrue", { enumerable: true, get: function () { return middleware_1.parseTrue; } });
exports.PATH_REGEX = '(.+)';
// '((?:[a-zA-Z0-9_\\-\\ \.]+/+)*[a-zA-Z0-9_\\-\\ \.]+)';
/**
 * Get's the size of a file or directory.
 *
 * @param {string} p The path to the file or directory
 * @returns {Promise<number>}
 */
async function sizeOf(p) {
    return fs.stat(p).then(stat => {
        if (stat.isFile())
            return stat.size;
        else if (stat.isDirectory())
            return fs.readdir(p)
                .then(entries => Promise.all(entries.map(e => sizeOf(path.join(p, e)))))
                .then(e => e.reduce((a, c) => a + c, 0));
        else
            return 0; // can't take size of a stream/symlink/socket/etc
    });
}
exports.sizeOf = sizeOf;
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', data => chunks.push(data));
        stream.on('error', reject);
        stream.on('drop', count => reject(new Error(`Dropped ${count} items from stream!`)));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.resume();
    });
}
exports.streamToBuffer = streamToBuffer;
