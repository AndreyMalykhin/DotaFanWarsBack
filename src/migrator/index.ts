import path = require('path');
import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import Migrator from './models/migrator';

export default class MigratorModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant(
            'migrationDataDirPath', process.env.DFWB_MIGRATION_DATA_DIR_PATH);
        di.factory('migrator', (diContainer: Bottle.IContainer) => {
            const storeFilePath = path.join(
                (<any> diContainer).migrationDataDirPath, '.migrate');
            return new Migrator(storeFilePath);
        });
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const migrator: Migrator = (<any> diContainer).migrator;
        const req = (<any> require).context('./migrations', false, /\.ts$/);
        req.keys()
            .map((modulePath: string) => {
                return {
                    migrationName: path.basename(modulePath, '.ts'),
                    modulePath: modulePath
                };
            })
            .sort((lhs: any, rhs: any) => {
                const lhsIndex = Number(/^(\d+)-/.exec(lhs.migrationName)[1]);
                const rhsIndex = Number(/^(\d+)-/.exec(rhs.migrationName)[1]);
                console.assert(lhsIndex != rhsIndex);
                return lhsIndex - rhsIndex;
            })
            .forEach((migrationInfo: any) => {
                const Migration = req(migrationInfo.modulePath).default;
                migrator.add(new Migration(
                    migrationInfo.migrationName, diContainer));
            });
        return migrator.up();
    }
}
