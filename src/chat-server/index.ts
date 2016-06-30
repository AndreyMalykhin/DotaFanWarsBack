import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import ChatServer from './models/chat-server';

export default class ChatServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.service('chatServer', <any> ChatServer, 'socketIO');
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const server: ChatServer = (<any> diContainer).chatServer;
        server.start();
        return Promise.resolve();
    }
}
