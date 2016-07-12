const sharp = require('sharp');
import uuid = require('node-uuid');
import path = require('path');
import debug = require('debug');
import passport = require('passport');
import User, {UserType} from './user';
import UserService from './user-service';
import {GOOGLE, FACEBOOK} from '../utils/auth-provider-id';

const log = debug('dfw:UserCommander');

export default class UserCommander {
    constructor(
        private userService: UserService,
        private staticDirPath: string,
        private staticUrl: string
    ) {}

    add(profile: passport.Profile) {
        log('add()');
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
        log('update(); id=%o', user.id);
        return this.userService.save(user);
    }

    updateById(id: string, data: Object) {
        log('updateById(); id=%o', id);
        return this.userService.updateById(id, data);
    }

    setPhoto(user: User, file: Buffer, fileName: string): Promise<User> {
        log('setPhoto(); fileName=%o', fileName);
        const newFileName = `${uuid.v4()}${path.extname(fileName)}`;
        const dirName = 'user-photos';
        const outputFilePath = path.join(this.staticDirPath, dirName, newFileName);
        return sharp(file).resize(128, 128).max().toFile(outputFilePath)
            .then(() => {
                user.photoUrl = `${this.staticUrl}/${dirName}/${newFileName}`;
                return this.userService.save(user);
            });
    }

    punishForLeave(id: string) {
        log('punishForLeave(); id=%o', id);
        const banDuration = 60 * 4 * 1000;
        return this.userService.updateById(
            id, {unbanDate: new Date(Date.now() + banDuration)});
    }
}
