import Bottle = require('bottlejs');
import express = require('express');

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.post('/:provider', function(req, res) {
        setTimeout(function() {
            res.json({
                status: 200,
                data: {accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE0NjQ1OTU1MTAsImV4cCI6MTQ5NjEzMTUxMCwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSJ9.3qFN6i56IC6Qh1ey2oqG6Qz6rYkpz5keOyG-8VRVBgg'}
            });
        }, 1000);
    });
    return controller;
}
