import path = require('path');
import Bottle = require('bottlejs');

abstract class Migration {
    constructor(public id: string, protected diContainer: Bottle.IContainer) {}

    abstract up(): Promise<void>;

    abstract down(): Promise<void>;

    getDataFilePath(fileName: string) {
        return path.join(
            (<any> this.diContainer).migrationDataDirPath,
            this.id,
            fileName
        );
    }
}

export default Migration;
