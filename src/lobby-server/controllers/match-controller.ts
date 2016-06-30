import Bottle = require('bottlejs');
import express = require('express');

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.get('/:matchId/rooms', function(req, res) {
        setTimeout(function() {
            res.json({
                status: 200,
                data: [
                    {
                        id: '1',
                        name: 'room 1',
                        gameServerUrl: req.protocol + '://' + req.get('Host') + '/game',
                        chatServerUrl: req.protocol + '://' + req.get('Host') + '/chat'
                    },
                    {
                        id: '2',
                        name: 'room 2',
                        gameServerUrl: req.protocol + '://' + req.get('Host') + '/game',
                        chatServerUrl: req.protocol + '://' + req.get('Host') + '/chat'
                    }
                ]
            });
        }, 1000);
    });
    return controller;
}
