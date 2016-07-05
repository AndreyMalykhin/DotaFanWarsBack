const migrate = require('migrate');
import debug = require('debug');
import Migration from './migration';

const log = debug('dfw:Migrator');

export default class Migrator {
    constructor(migrationsDirPath: string) {
        migrate(migrationsDirPath);
    }

    add(migration: Migration) {
        log('add(); migration=%o', migration.id);
        migrate(
            migration.id,
            (next: (error?: Error) => void) => {
                migration.up().then(() => {next();}, next);
            },
            (next: (error?: Error) => void) => {
                migration.down().then(() => {next();}, next);
            }
        );
    }

    up() {
        log('up()');
        return new Promise((resolve, reject) => {
            const set = migrate();
            set.on('migration', (migration: any, direction: string) => {
                log('direction=%o; migration=%o', direction, migration.title);
            });
            set.up((error: Error) => {
                error ? reject(error) : resolve();
            });
        });
    }
}
