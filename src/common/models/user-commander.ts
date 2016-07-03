import debug = require('debug');
import passport = require('passport');
import User, {UserType} from './user';
import UserService from './user-service';
import {GOOGLE, FACEBOOK} from '../utils/auth-provider-id';

const log = debug('dfw:UserCommander');

export default class UserCommander {
    constructor(private userService: UserService) {}

    add(profile: passport.Profile) {
        log('add(); profile=%o', profile);
        const user = new UserType();
        user.nickname = profile.displayName;
        user.email = profile.emails[0].value;

        if (profile.photos && profile.photos.length) {
            user.photoUrl = profile.photos[0].value;
        }

        switch (profile.provider) {
        case GOOGLE:
            user.googleId = profile.id;
        case FACEBOOK:
            user.facebookId = profile.id;
        }

        return this.userService.save(user);
    }

    update(user: User) {
        return this.userService.save(user);
    }
}
