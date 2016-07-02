import express = require('express');
import Bottle = require('bottlejs');
import passport = require('passport');
import HttpStatus = require('http-status-codes');
import UserService from '../../common/models/user-service';
import User from '../../common/models/user';
import ApiResponse from '../../common/utils/api-response';

export default function factory(diContainer: Bottle.IContainer) {
    return (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const userService: UserService = (<any> diContainer).userService;
        const authService: passport.Passport = (<any> diContainer).authService;
        const authenticator = authService.authenticate(
            'jwt',
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
                    return next(error || null);
                });
            }
        );
        authenticator(req, res, next);
    }
}
