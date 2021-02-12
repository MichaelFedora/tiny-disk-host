/// <reference types="node" />
import { Readable } from 'stream';
export { parseTrue } from 'tiny-host-common/lib/middleware';
export declare const PATH_REGEX = "(.+)";
/**
 * Get's the size of a file or directory.
 *
 * @param {string} p The path to the file or directory
 * @returns {Promise<number>}
 */
export declare function sizeOf(p: string): Promise<number>;
export declare function streamToBuffer(stream: Readable): Promise<Buffer>;
