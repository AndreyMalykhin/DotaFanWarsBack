export default class MatchServer {
    constructor(private socketIO: SocketIO.Server) {}

    start(): void {
        var enemyHealth = 20;
        var myHealth = 77;
        var myMoney = 7;
        var myItemCount: {[id: string]: number} = {
            '1': 2,
            '2': 2
        };
        var itemPrices: {[id: string]: number} = {
            '1': 7,
            '2': 77
        };
        var teamScores: {[id: string]: number} = {
            '1': 0,
            '2': 0
        };
        this.socketIO.of('/game')
            .on('connection', function (socket) {
                // console.log(socket.handshake.query);
                setTimeout(function() {
                    socket.emit('messages', [
                        {type: 'start', data: {myCharacterId: '1'}},
                        {
                            type: 'updateTeams',
                            data: [
                                {
                                    id: '1',
                                    name: 'Some very long team name',
                                    score: teamScores['1'],
                                    logoUrl: 'https://placekitten.com/512/512'
                                },
                                {
                                    id: '2',
                                    name: 'Some very long team name 2',
                                    score: teamScores['2'],
                                    logoUrl: 'https://placekitten.com/512/512'
                                }
                            ]
                        },
                        {
                            type: 'updateItems',
                            data: [
                                {
                                    id: '1',
                                    type: 'offensive',
                                    name: 'Some very long item name',
                                    price: itemPrices['1'],
                                    photoUrl: 'http://dotafanwarsfront.local:8080/items/item-1.svg'
                                },
                                {
                                    id: '2',
                                    type: 'defensive',
                                    name: 'Some very long item name 2',
                                    price: itemPrices['2'],
                                    photoUrl: 'http://dotafanwarsfront.local:8080/items/item-2.svg'
                                }
                            ]
                        },
                        {
                            type: 'updateCountries',
                            data: [
                                {
                                    id: '1',
                                    name: 'USA',
                                    flagUrl: 'http://dotafanwarsfront.local:8080/countries/US.png'
                                },
                                {
                                    id: '2',
                                    name: 'Ukraine',
                                    flagUrl:
                                    'http://dotafanwarsfront.local:8080/countries/UA.png'
                                },
                                {
                                    id: '3',
                                    name: 'Italy',
                                    flagUrl: 'http://dotafanwarsfront.local:8080/countries/IT.png'
                                }
                            ]
                        },
                        {
                            type: 'updateCharacters',
                            data: [
                                {
                                    id: '1',
                                    teamId: '1',
                                    health: myHealth,
                                    money: myMoney,
                                    seatId: null,
                                    items: [
                                        {id: '1', count: myItemCount['1']},
                                        {id: '2', count: myItemCount['2']}
                                    ],
                                    user: {
                                        id: '1',
                                        photoUrl: 'https://placekitten.com/512/512',
                                        nickname: 'Some very long nickname',
                                        countryId: '1',
                                        rating: 7
                                    }
                                },
                                {
                                    id: '2',
                                    teamId: '1',
                                    health: 77,
                                    seatId: '1',
                                    user: {
                                        id: '2',
                                        photoUrl: 'https://placekitten.com/512/512',
                                        nickname: 'Some very long nickname 2',
                                        countryId: '2',
                                        rating: 77
                                    }
                                },
                                {
                                    id: '3',
                                    teamId: '2',
                                    health: enemyHealth,
                                    seatId: '16',
                                    user: {
                                        id: '3',
                                        photoUrl: 'https://placekitten.com/512/512',
                                        nickname: 'Some very long nickname 3',
                                        countryId: '3',
                                        rating: 777
                                    }
                                }
                            ]
                        },
                        {
                            type: 'updateSeats',
                            data: [
                                {id: '1', characterId: '2'},
                                {id: '16', characterId: '3'}
                            ]
                        }
                    ]);

                    setInterval(function() {
                        myHealth = getRandomInt(1, 100);
                        myMoney = getRandomInt(1, 100);
                        enemyHealth = getRandomInt(1, 100);
                        teamScores['1'] = getRandomInt(0, 100);
                        teamScores['2'] = getRandomInt(0, 100);
                        myItemCount['1'] = getRandomInt(0, 100);
                        myItemCount['2'] = getRandomInt(0, 100);
                        socket.emit('messages', [
                            {
                                type: 'updateCharacters',
                                data: [
                                    {
                                        id: '1',
                                        health: myHealth,
                                        money: myMoney,
                                        items: [
                                            {id: '1', count: myItemCount['1']},
                                            {id: '2', count: myItemCount['2']}
                                        ]
                                    },
                                    {id: '3', health: enemyHealth}
                                ]
                            },
                            {
                                type: 'updateTeams',
                                data: [
                                    {id: '1', score: teamScores['1']},
                                    {id: '2', score: teamScores['2']}
                                ]
                            }
                        ]);
                    }, 5000);
                }, 1000);

                socket.on('takeSeat', function(cmd: any, onResponse: Function) {
                    setTimeout(function() {
                        onResponse([
                            {type: 'updateSeats', data: [{id: cmd.seatId, characterId: '1'}]},
                            {type: 'updateCharacters', data: [{id: '1', seatId: cmd.seatId}]}
                        ]);
                    }, 1000);
                });

                socket.on('buyItem', function(cmd: any, onResponse: Function) {
                    setTimeout(function() {
                        myMoney -= itemPrices[cmd.itemId];
                        ++myItemCount[cmd.itemId];
                        onResponse([
                            {
                                type: 'updateCharacters',
                                data: [
                                    {
                                        id: '1',
                                        money: myMoney,
                                        items: [{id: cmd.itemId, count: myItemCount['1']}]
                                    }
                                ]
                            }
                        ]);
                    }, 1000);

                    // setTimeout(function() {
                    //     socket.emit('messages', [
                    //         {type: 'updateCharacters', data: [{id: '1', health: 0}]}
                    //     ]);
                    // }, 5000);
                });

                socket.on('useItem', function(cmd: any, onResponse: Function) {
                    setTimeout(function() {
                        --myItemCount[cmd.itemId];

                        if (cmd.itemId == '1') {
                            var projectileId = String(Date.now());
                            onResponse([
                                {
                                    type: 'updateProjectiles',
                                    data: [{id: projectileId, targetId: cmd.targetId}]
                                },
                                {
                                    type: 'updateCharacters',
                                    data: [
                                        {
                                            id: '1',
                                            items: [{id: cmd.itemId, count: myItemCount[cmd.itemId]}]
                                        }
                                    ]
                                }
                            ]);
                            setTimeout(function() {
                                enemyHealth -= 7;
                                socket.emit('messages', [
                                    {
                                        type: 'removeProjectiles',
                                        data: [projectileId]
                                    },
                                    {
                                        type: 'updateCharacters',
                                        data: [{id: cmd.targetId, health: enemyHealth}]
                                    }
                                ]);

                                if (enemyHealth <= 0) {
                                    socket.emit('messages', [
                                        {type: 'end', data: {winnerId: '1', myRatingDelta: 77}}
                                    ]);
                                    setTimeout(function() {
                                        socket.disconnect(true);
                                    }, 10000);
                                }
                            }, 1000);
                        } else {
                            myHealth += 7;
                            onResponse([
                                {
                                    type: 'updateCharacters',
                                    data: [
                                        {
                                            id: '1',
                                            health: myHealth,
                                            items: [{id: cmd.itemId, count: myItemCount[cmd.itemId]}]
                                        }
                                    ]
                                }
                            ]);
                        }
                    }, 1000);
                });
            });

        function getRandomInt(min: number, max: number) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
}
