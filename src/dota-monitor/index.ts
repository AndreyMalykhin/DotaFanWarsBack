import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import DotaMatchMonitor from './models/dota-match-monitor';
import DotaTeamMonitor from './models/dota-team-monitor';

export default class DotaMonitorModule implements Module {
    preBootstrap(di: Bottle) {
        di.service(
            'dotaMatchMonitor',
            <any> DotaMatchMonitor,
            'dotaService',
            'matchService',
            'teamService',
            'matchCommander'
        );
        di.service('dotaTeamMonitor', <any> DotaTeamMonitor, 'dotaService',
            'teamService', 'teamCommander');
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const matchMonitor: DotaMatchMonitor =
            (<any> diContainer).dotaMatchMonitor;
        matchMonitor.start();
        const teamMonitor: DotaTeamMonitor =
            (<any> diContainer).dotaTeamMonitor;
        teamMonitor.start();
        return Promise.resolve();
    }
}
