import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import httpServerFactory from './utils/http-server-factory';
import lobbyServerFactory from './models/lobby-server-factory';
import authServiceFactory from './utils/auth-service-factory';
import authorizationHandlerFactory from './utils/authorization-handler-factory';

export default class LobbyServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant('port', parseInt(process.env.DFWB_PORT, 10));
        di.constant('facebookAppId', process.env.DFWB_FACEBOOK_APP_ID);
        di.constant('facebookAppSecret', process.env.DFWB_FACEBOOK_APP_SECRET);
        di.constant('googleAppId', process.env.DFWB_GOOGLE_APP_ID);
        di.constant('googleAppSecret', process.env.DFWB_GOOGLE_APP_SECRET);
        di.factory('authorizationHandler', authorizationHandlerFactory);
        di.factory('authService', authServiceFactory);
        di.factory('lobbyServer', lobbyServerFactory);
        di.factory('httpServer', httpServerFactory);
    }

    bootstrap(diContainer: Bottle.IContainer) {
        return Promise.resolve();
    }
}
