import Bottle = require('bottlejs');
import express = require('express');
import HttpStatus = require('http-status-codes');
import RoomService from '../../common/models/room-service';
import ApiResponse from '../../common/utils/api-response';

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    const roomService: RoomService = (<any> diContainer).roomService;
    controller.get('/:id/rooms', (req, res, next) => {
        roomService.getAll({
            matchId: req.params.id,
            matchServerUrl: {$ne: null}}
        )
        .exec()
        .then((rooms) => {
            res.json(<ApiResponse> {
                status: HttpStatus.OK,
                data: rooms.map((room) => {
                    const {id, name, matchServerUrl, chatServerUrl} = room;
                    return {id, name, matchServerUrl, chatServerUrl};
                })
            });
        }, next);
    });
    return controller;
}
