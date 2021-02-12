import * as path from 'path';
import * as fs from 'fs-extra';
import { Readable } from 'stream';

export { parseTrue } from 'tiny-host-common/lib/middleware';

export const PATH_REGEX = '(.+)';
// '((?:[a-zA-Z0-9_\\-\\ \.]+/+)*[a-zA-Z0-9_\\-\\ \.]+)';

/**
 * Get's the size of a file or directory.
 *
 * @param {string} p The path to the file or directory
 * @returns {Promise<number>}
 */
export async function sizeOf(p: string): Promise<number> {
  return fs.stat(p).then(stat => {
    if(stat.isFile())
      return stat.size;
    else if(stat.isDirectory())
      return fs.readdir(p)
        .then(entries => Promise.all(entries.map(e => sizeOf(path.join(p, e)))))
        .then(e => e.reduce((a, c) => a + c, 0));
    else return 0; // can't take size of a stream/symlink/socket/etc
  });
}


export function streamToBuffer(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks = [];
    stream.on('data', data => chunks.push(data));
    stream.on('error', reject);
    stream.on('drop', count => reject(new Error(`Dropped ${count} items from stream!`)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.resume();
  });
}
