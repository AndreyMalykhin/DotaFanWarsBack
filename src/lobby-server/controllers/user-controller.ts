import Bottle = require('bottlejs');
import express = require('express');

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.put('/:id/photo', function(req, res) {
        setTimeout(function() {
            // res.json({
            //     status: 400,
            //     data: {file: 'Oh no no no!'}
            // });
            res.json({
                status: 200,
                data: {url: 'https://placekitten.com/512/512'}
            });
        }, 1000);
    });

    controller.put('/:id', function(req, res) {
        setTimeout(function() {
            // res.json({
            //     status: 400,
            //     data: {nickname: 'Oh no no no!', countryId: 'Oh no no no!'}
            // });
            res.json({
                status: 200,
                data: Object.assign({rating: 7777}, req.body)
            });
        }, 1000);
    });

    controller.get('/:id', function(req, res) {
        setTimeout(function() {
            res.json({
                status: 200,
                data: {
                    rating: 7777,
                    nickname: 'Some very long nickname',
                    countryId: '2',
                    photoUrl: 'https://placekitten.com/512/512'
                }
            });
        }, 1000);
    });

    controller.get('/', function(req, res) {
        console.assert(req.query.leaderboard !== undefined);
        setTimeout(function() {
            res.json({
                status: 200,
                data: [
                    {
                        id: '1',
                        rating: 7777,
                        nickname: 'Some very long nickname',
                        country: {
                            flagUrl: 'http://dotafanwarsfront.local:8080/countries/US.png'
                        }
                    },
                    {
                        id: '2',
                        rating: 777,
                        nickname: 'Some very long nickname 2',
                        country: {
                            flagUrl: 'http://dotafanwarsfront.local:8080/countries/UA.png'
                        }
                    }
                ]
            });
        }, 1000);
    });
    return controller;
}
