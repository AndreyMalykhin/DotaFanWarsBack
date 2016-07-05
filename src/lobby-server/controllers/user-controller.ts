import multer = require('multer');
import stream = require('stream');
import _ = require('lodash');
import Bottle = require('bottlejs');
import express = require('express');
import HttpStatus = require('http-status-codes');
import UserService from '../../common/models/user-service';
import UserCommander from '../../common/models/user-commander';
import ApiResponse from '../../common/utils/api-response';
import User, {UserType} from '../../common/models/user';
import Country from '../../common/models/country';
import Translator from '../../common/utils/translator';

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    const userService: UserService = (<any> diContainer).userService;
    const userCommander: UserCommander = (<any> diContainer).userCommander;
    const translator: Translator = (<any> diContainer).translator;

    controller.all('/me*', (<any> diContainer).authorizationHandler);

    const maxFileSize = 1024 * 1024;
    controller.put(
        '/me/photo',
        multer({
            limits: {fieldSize: maxFileSize, fileSize: maxFileSize},
            storage: multer.memoryStorage()
        }).single('file'),
        (req, res, next) => {
            const file = req.file;
            userCommander.setPhoto(req.user, file.buffer, file.originalname)
                .then((user) => {
                    res.json(<ApiResponse> {
                        status: HttpStatus.OK,
                        data: {url: user.photoUrl}
                    });
                }, next);
        }
    );

    controller.put('/me', function(req, res, next) {
        const user = <User> req.user;
        ['nickname', 'country'].forEach((field) => {
            const fieldValue = req.body[field];

            if (fieldValue !== undefined) {
                user.set(field, fieldValue);
            }
        });

        userCommander.update(user)
            .then((user) => {
                return UserType.populate(user, {path: 'country'});
            })
            .then((user) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: transformUser(user)
                });
            }, (error) => {
                const validationErrors = error.errors;

                if (!validationErrors) {
                    next(error);
                    return;
                }

                const status = HttpStatus.BAD_REQUEST;
                res.status(status).json(<ApiResponse> {
                    status: status,
                    data: _.mapValues(validationErrors, (error) => {
                        return translator.t(error.message);
                    })
                });
            });
    });

    controller.get('/me', function(req, res, next) {
        UserType.populate(req.user, {path: 'country'})
            .then((user) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: transformUser(user)
                });
            }, (error) => {
                next(error);
            });
    });

    controller.get('/:id', function(req, res, next) {
        userService.get({_id: req.params.id}).populate('country').exec()
            .then((user) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: transformUser(user)
                });
            }, next);
    });

    controller.get('/', function(req, res, next) {
        if (req.query.leaderboard === undefined) {
            return next();
        }

        userService.getAll()
            .populate('country')
            .sort('-rating')
            .limit(100)
            .exec()
            .then((users) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: users.map(transformUser)
                });
            }, next);
    });
    return controller;
}

function transformUser(user: User) {
    const {id, rating, nickname, photoUrl, country} = user;
    let transformedCountry: Object = null;

    if (country) {
        const {id: countryId, name: countryName, flagUrl: countryFlagUrl} =
            <Country> country;
        transformedCountry = {
            id: countryId,
            name: countryName,
            flagUrl: countryFlagUrl
        }
    }

    return {
        id: id,
        rating: rating,
        nickname: nickname,
        photoUrl: photoUrl,
        country: transformedCountry
    };
}
