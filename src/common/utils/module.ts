import Bottle = require('bottlejs');

interface Module {
    preBootstrap(di: Bottle): void;
    bootstrap(diContainer: Bottle.IContainer): Promise<any>;
}

export default Module;
