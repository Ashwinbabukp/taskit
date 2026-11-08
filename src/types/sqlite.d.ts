declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: any[]): { lastInsertRowid: number | bigint; changes: number | bigint };
      get(...params: any[]): any;
      all(...params: any[]): any[];
    };
    close(): void;
  }
}

