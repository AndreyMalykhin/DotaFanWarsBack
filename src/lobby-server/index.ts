import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import httpServerFactory from './utils/http-server-factory';
import lobbyServerFactory from './models/lobby-server-factory';

export default class LobbyServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant('port', parseInt(process.env.DFWB_PORT, 10));
        di.factory('lobbyServer', lobbyServerFactory);
        di.factory('httpServer', httpServerFactory);
    }

    bootstrap(diContainer: Bottle.IContainer) {
        return Promise.resolve();
    }
}
