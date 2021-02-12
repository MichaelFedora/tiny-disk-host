# Tiny Disk Host

A tiny software to host a multi-user disk storage unit.

**Warning**: There is no encryption here, and therefore no privacy
from the host. Applications must encrypt the files if they so desire.

### Config

in `config.json`, with the following (annotated) schema:

```typescript
interface Config {
  ip: string; // api ip
  port: number; // api port

  sessionExpTime: number; // how much time (in ms) for the sessions to expire
  whitelist?: string[]; // a whilte list of usernames to allow

  dbName: string; // level db folder name
  storageRoot: string; // root storage folder

  storageMax?: number; // max storage size in bytes
  storageUserMax?: number; // max per-user storage size in bytes
}
```

### API

todo

### todo

- copy & move commands, instead of having to read/write
  all the data

### License

MIT
