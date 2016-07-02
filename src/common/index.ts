import debug = require('debug');
import events = require('events');
import mongoose = require('mongoose');
import Bottle = require('bottlejs');
import socketIO = require('socket.io');
import Module from './utils/module';
import MatchCommander from './models/match-commander';
import TeamCommander from './models/team-commander';
import MatchService from './models/match-service';
import TeamService from './models/team-service';
import DotaService from './models/dota-service';
import UserService from './models/user-service';
import UserCommander from './models/user-commander';

const log = debug('dfw:CommonModule');

export default class CommonModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant('secretKey', process.env.DFWB_SECRET_KEY);
        di.constant('steamApiKey', process.env.DFWB_STEAM_API_KEY);
        di.factory('socketIO', function(diContainer: Bottle.IContainer) {
            return socketIO((<any> diContainer).httpServer,
                {transports: ['websocket', 'polling']});
        });
        di.service('eventBus', <any> events.EventEmitter);
        di.service('dotaService', <any> DotaService, 'steamApiKey');
        di.service('matchService', <any> MatchService);
        di.service('teamService', <any> TeamService);
        di.service('matchCommander', <any> MatchCommander, 'matchService',
            'eventBus');
        di.service('teamCommander', <any> TeamCommander, 'teamService');
        di.service('userService', <any> UserService);
        di.service('userCommander', <any> UserCommander, 'userService');
    }

    bootstrap(diContainer: Bottle.IContainer) {
        mongoose.Promise = <any> Promise;
        return new Promise(function(resolve, reject) {
            mongoose.connect(process.env.DFWB_DB_URL, function(error: any) {
                if (error) {
                    // TODO
                    log(error);
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
}
