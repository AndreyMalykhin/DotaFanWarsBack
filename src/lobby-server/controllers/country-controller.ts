import Bottle = require('bottlejs');
import express = require('express');

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.get('/', function(req, res) {
        setTimeout(function() {
            res.json({
                status: 200,
                data: [
                    {id: '1', name: 'Ukraine'},
                    {id: '2', name: 'USA'},
                    {id: '3', name: 'Italy'},
                ]
            });
        }, 1000);
    });
    return controller;
}
