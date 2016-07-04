import fs = require('fs');
import mkdirp = require('mkdirp');
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
import Translator from './utils/translator';
import {addTranslations} from './utils/translator-utils';

const log = debug('dfw:CommonModule');

export default class CommonModule implements Module {
    preBootstrap(di: Bottle) {
        di.constant('staticDirPath', process.env.DFWB_STATIC_DIR_PATH);
        di.constant('staticDirUrl', process.env.DFWB_STATIC_DIR_URL);
        di.constant('facebookAppId', process.env.DFWB_FACEBOOK_APP_ID);
        di.constant('facebookAppSecret', process.env.DFWB_FACEBOOK_APP_SECRET);
        di.constant('googleAppId', process.env.DFWB_GOOGLE_APP_ID);
        di.constant('googleAppSecret', process.env.DFWB_GOOGLE_APP_SECRET);
        di.constant('secretKey', process.env.DFWB_SECRET_KEY);
        di.constant('steamApiKey', process.env.DFWB_STEAM_API_KEY);
        di.factory('socketIO', (diContainer) => {
            return socketIO((<any> diContainer).httpServer,
                {transports: ['websocket', 'polling']});
        });
        di.service('translator', <any> Translator);
        di.service('eventBus', <any> events.EventEmitter);
        di.service('dotaService', <any> DotaService, 'steamApiKey');
        di.service('matchService', <any> MatchService);
        di.service('teamService', <any> TeamService);
        di.service('matchCommander', <any> MatchCommander, 'matchService',
            'eventBus');
        di.service('teamCommander', <any> TeamCommander, 'teamService');
        di.service('userService', <any> UserService);
        di.service('userCommander', <any> UserCommander, 'userService',
            'staticDirPath', 'staticDirUrl');
    }

    bootstrap(diContainer: Bottle.IContainer) {
        return new Promise(function(resolve, reject) {
            const staticDirPath: string = (<any> diContainer).staticDirPath;

            try {
                fs.statSync(staticDirPath);
            } catch (error) {
                mkdirp.sync(staticDirPath);
            }

            const translator: Translator = (<any> diContainer).translator;
            addTranslations(translator, `${__dirname}/translations`);

            mongoose.Promise = <any> Promise;
            mongoose.connect(process.env.DFWB_DB_URL, (error: any) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
}
