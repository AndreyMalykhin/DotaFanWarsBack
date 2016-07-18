import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import ChatServer from './models/chat-server';
import Translator from '../common/utils/translator';
import {addTranslations} from '../common/utils/translator-utils';

export default class ChatServerModule implements Module {
    preBootstrap(di: Bottle) {
        di.service(
            'chatServer',
            <any> ChatServer,
            'host',
            'port',
            'socketIO',
            'eventBus',
            'socketAuthorizationService',
            'roomService',
            'matchCommander',
            'translator'
        );
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const server: ChatServer = (<any> diContainer).chatServer;
        return server.start().then(() => {
            const translator: Translator = (<any> diContainer).translator;
            const req =
                (<any> require).context('./translations', false, /\.json$/);
            addTranslations(translator, req);
        });
    }
}
