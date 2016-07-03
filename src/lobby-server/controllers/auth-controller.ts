import Bottle = require('bottlejs');
import express = require('express');
import passport = require('passport');
import jwt = require('jsonwebtoken');
import HttpStatus = require('http-status-codes');
import ApiResponse from '../../common/utils/api-response';
import User from '../../common/models/user';
import {GOOGLE, FACEBOOK} from '../../common/utils/auth-provider-id';

const authStretegies: {[provider: string]: string} = {
    [FACEBOOK]: 'facebook-token',
    [GOOGLE]: 'google-token'
};

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    const authService: passport.Passport = (<any> diContainer).authService;
    controller.post('/:provider', (req, res, next) => {
        const authenticator = authService.authenticate(
            authStretegies[req.params.provider],
            (error?: Error, user?: User, authInfo?: any) => {
                if (error) {
                    return next(error);
                } else if (!user) {
                    const status = HttpStatus.UNAUTHORIZED;
                    res.status(status).json(<ApiResponse> {
                        status: status,
                        error: {msg: HttpStatus.getStatusText(
                            HttpStatus.UNAUTHORIZED)}
                    });
                    return;
                }

                req.login(user, {session: false}, (error) => {
                    if (error) {
                        return next(error);
                    }

                    const user = <User> req.user;
                    jwt.sign(
                        {id: user.id},
                        (<any> diContainer).secretKey,
                        {expiresIn: '365 days'},
                        (error, accessToken) => {
                            if (error) {
                                return next(error);
                            }

                            res.json(<ApiResponse> {
                                status: HttpStatus.OK,
                                data: {accessToken: accessToken}
                            });
                        }
                    );
                });
            }
        );
        authenticator(req, res, next);
    });
    return controller;
}
