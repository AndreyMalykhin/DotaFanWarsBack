import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import MatchServer from './models/match-server';

export default class MatchServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.service('matchServer', <any> MatchServer, 'socketIO', 'eventBus',
            'matchCommander');
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const server: MatchServer = (<any> diContainer).matchServer;
        return server.start();
    }
}
