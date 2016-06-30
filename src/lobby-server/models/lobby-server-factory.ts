import Bottle = require('bottlejs');
import express = require('express');
import logger = require('morgan');
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import cors = require('cors');
import ApiResponse from '../../common/utils/api-response';
import authControllerFactory from '../controllers/auth-controller';
import userControllerFactory from '../controllers/user-controller';
import countryControllerFactory from '../controllers/country-controller';
import matchControllerFactory from '../controllers/match-controller';
import matchScheduleControllerFactory from
    '../controllers/match-schedule-controller';

export default function lobbyServerFactory(diContainer: Bottle.IContainer) {
    const server = express();

    if (process.env.DFWB_DEV == '1') {
        server.use(logger('dev'));
    }

    server.use(cors({
        credentials: true,
        maxAge: 60 * 60 * 24
    }));
    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({ extended: false }));
    server.use(cookieParser());
    server.use(errorHandler);

    server.use('/v1/login', authControllerFactory(diContainer));
    server.use('/v1/users', userControllerFactory(diContainer));
    server.use('/v1/countries', countryControllerFactory(diContainer));
    server.use('/v1/matches', matchControllerFactory(diContainer));
    server.use('/v1/match-schedule',
        matchScheduleControllerFactory(diContainer));

    server.use(missingResourceHandler);
    return server;
}

function errorHandler(err: any, req: express.Request, res: express.Response,
    next: express.NextFunction) {
    const status = 500;
    res.status(status);

    if (process.env.DFWB_DEV == '1') {
        res.json(err);
        return;
    }

    res.json(<ApiResponse> {
        status: status,
        error: {msg: 'Oops, something went wrong'}
    });
}

function missingResourceHandler(req: express.Request, res: express.Response,
    next: express.NextFunction) {
    const status = 404;
    res.status(status).json(<ApiResponse> {
        status: status,
        error: {msg: 'Not found'}
    });
}
