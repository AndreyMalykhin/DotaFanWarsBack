import Bottle = require('bottlejs');
import http = require('http');

export default function httpServerFactory(diContainer: Bottle.IContainer) {
    const port: number = (<any> diContainer).port;
    const server = http.createServer((<any> diContainer).lobbyServer);
    server.on('error', function(error: any) {
        if (error.syscall !== 'listen') {
            throw error;
        }

        const bind = typeof port === 'string' ? 'Pipe ' + port
            : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
        }
    });
    server.on('listening', function() {
        const addr = server.address();
        const bind = typeof addr === 'string' ? 'pipe ' + addr
            : 'port ' + addr.port;
        console.log('Listening on ' + bind);
    });
    server.listen(port);
    return server;
}
