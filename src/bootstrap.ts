import 'babel-polyfill';
import dotenv = require('dotenv');
import Bottle = require('bottlejs');
import debug = require('debug');
import Module from './common/utils/module';
import CommonModule from './common';
import RoomMonitorModule from './room-monitor';
import MatchServerModule from './match-server';
import LobbyServerModule from './lobby-server';
import ChatServerModule from './chat-server';
import DotaMonitorModule from './dota-monitor';
import {forEach} from './common/utils/promise-utils';

const log = debug('dfw:bootstrap');
dotenv.config();
const di = new Bottle();
const modules: Module[] = [
    new CommonModule(),
    new RoomMonitorModule(),
    new MatchServerModule(),
    new LobbyServerModule(),
    new ChatServerModule(),
    new DotaMonitorModule()
];

for (let m of modules) {
    m.preBootstrap(di);
}

const diContainer = di.container;

forEach(modules, function(m) {
    return m.bootstrap(diContainer);
}).catch((error) => {
    // TODO
    log(error);
});
