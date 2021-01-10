# Tiny Disk Host

A tiny software to host a multi-user disk storage unit.

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
}
```

### API

todo

### License

MIT
