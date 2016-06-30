export default class ChatServer {
    constructor(private socketIO: SocketIO.Server) {}

    start(): void {
        this.socketIO.of('/chat')
            .on('connection', function (socket) {
                setTimeout(function() {
                    socket.emit('messages', [
                        {type: 'start'},
                        {type: 'updateUsers', data: [{id: '1', nickname: 'Me'}]},
                        {
                            type: 'updateMessages',
                            data: [
                                {
                                    id: String(Date.now()),
                                    body: 'Welcome!',
                                    date: new Date().toISOString()
                                }
                            ]
                        }
                    ]);
                }, 1000);

                socket.on('sendMsg', function(cmd: any, onResponse: Function) {
                    setTimeout(function() {
                        onResponse([
                            {
                                type: 'updateMessages',
                                data: [
                                    {
                                        id: String(Date.now()),
                                        body: cmd.msg,
                                        senderId: '1',
                                        date: new Date().toISOString()
                                    }
                                ]
                            }
                        ]);
                    }, 1000);
                });
            });
    }
}
