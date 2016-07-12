import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import MatchServer from './models/match-server';

export default class MatchServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.service(
            'matchServer',
            <any> MatchServer,
            'host',
            'port',
            'socketIO',
            'eventBus',
            'matchCommander',
            'secretKey',
            'userService',
            'roomService',
            'matchService',
            'itemService',
            'countryService',
            'userCommander',
            'teamCommander',
            'translator'
        );
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const server: MatchServer = (<any> diContainer).matchServer;
        return server.start();
    }
}
