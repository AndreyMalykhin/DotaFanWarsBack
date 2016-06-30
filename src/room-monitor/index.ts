import Bottle = require('bottlejs');
import Module from '../common/utils/module';
import RoomMonitor from './models/room-monitor';

export default class RoomMonitorModule implements Module {
    preBootstrap(di: Bottle) {
        di.service('roomMonitor', <any> RoomMonitor);
    }

    bootstrap(diContainer: Bottle.IContainer) {
        const monitor: RoomMonitor = (<any> diContainer).roomMonitor;
        monitor.start();
        return Promise.resolve();
    }
}
