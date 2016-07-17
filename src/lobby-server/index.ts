import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import httpServerFactory from './utils/http-server-factory';
import lobbyServerFactory from './models/lobby-server-factory';
import authServiceFactory from './utils/auth-service-factory';
import authorizationHandlerFactory from
    './utils/http-authorization-handler-factory';
import localeHandlerFactory from './utils/locale-handler-factory';

export default class LobbyServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant('port', parseInt(process.env.DFWB_PORT, 10));
        di.factory('httpAuthorizationHandler', authorizationHandlerFactory);
        di.factory('localeHandler', localeHandlerFactory);
        di.factory('authService', authServiceFactory);
        di.factory('lobbyServer', lobbyServerFactory);
        di.factory('httpServer', httpServerFactory);
    }

    bootstrap(diContainer: Bottle.IContainer) {
        return Promise.resolve();
    }
}
