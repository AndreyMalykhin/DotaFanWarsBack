const {Strategy: GoogleAuthStrategy} = require('passport-google-token');
const FacebookAuthStrategy = require('passport-facebook-token');
import debug = require('debug');
import Bottle = require('bottlejs');
import passport = require('passport');
import {Strategy as JwtAuthStrategy, ExtractJwt} from 'passport-jwt';
import UserCommander from '../../common/models/user-commander';
import UserService from '../../common/models/user-service';
import User from '../../common/models/user';

const log = debug('dfw:AuthService');
const profileFields = ['id', 'displayName', 'emails', 'photos'];

export default function authServiceFactory(diContainer: Bottle.IContainer) {
    const userCommander: UserCommander = (<any> diContainer).userCommander;
    const userService: UserService = (<any> diContainer).userService;
    passport.use(new FacebookAuthStrategy(
        {
            clientID: (<any> diContainer).facebookAppId,
            clientSecret: (<any> diContainer).facebookAppSecret,
            profileFields: profileFields
        },
        (
            accessToken: string,
            refreshToken: string,
            userProfile: passport.Profile,
            onDone: (error: Error, user: User) => void
        ) => {
            onAuth(userService, userCommander, accessToken, refreshToken,
                userProfile, onDone);
        }
    ));

    passport.use(new GoogleAuthStrategy(
        {
            clientID: (<any> diContainer).googleAppId,
            clientSecret: (<any> diContainer).googleAppSecret,
            profileFields: profileFields
        },
        (
            accessToken: string,
            refreshToken: string,
            userProfile: passport.Profile,
            onDone: (error: Error, user: User) => void
        ) => {
            userProfile.photos = userProfile.photos ||
                [{value: (<any> userProfile)._json.picture}];
            onAuth(userService, userCommander, accessToken, refreshToken,
                userProfile, onDone);
        }
    ));

    passport.use(new JwtAuthStrategy(
        {
            secretOrKey: (<any> diContainer).secretKey,
            jwtFromRequest: ExtractJwt.fromAuthHeader()
        },
        (jwtPayload, onDone) => {
            userService.get({_id: jwtPayload.id}).exec()
                .then((user) => {
                    const error: Error = null;
                    onDone(error, user);
                }, (error) => {
                    onDone(error);
                });
        }
    ));
    return passport;
}

function onAuth(
    userService: UserService,
    userCommander: UserCommander,
    accessToken: string,
    refreshToken: string,
    userProfile: passport.Profile,
    onDone: (error?: Error, user?: User) => void
) {
    userService.get({email: userProfile.emails[0].value}).exec()
        .then((user) => {
            return user || userCommander.add(userProfile);
        })
        .then((user) => {
            const error: Error = null;
            onDone(error, user);
        }, (error) => {
            onDone(error);
        });
}
