import { pbkdf2 } from 'crypto';
import * as path from 'path';
import fs from 'fs-extra';

export async function hash(salt: string, password: string) {
  return new Promise<string>((res, rej) => {
    pbkdf2(password, salt, 10000, 512, 'sha256', (err, data) => {
      if(err)
        return rej(err);
      else
        return res(data.toString('hex'));
    });
  });
}

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
