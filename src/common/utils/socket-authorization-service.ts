import jwt = require('jsonwebtoken');
import Bottle = require('bottlejs');
import User from '../../common/models/user';
import UserService from '../../common/models/user-service';

export default class SocketAuthorizationService {
    constructor(private secretKey: string, private userService: UserService) {}

    authorize(accessToken: string) {
        return <Promise<User>> new Promise((resolve, reject) => {
            jwt.verify(
                accessToken,
                this.secretKey,
                (error: Error, jwtPayload: any) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    const userId = jwtPayload.id;
                    this.userService.get({_id: userId}).exec().then((user) => {
                        if (!user) {
                            reject(new Error(`User ${userId} not found`));
                            return;
                        }

                        resolve(user);
                    }, reject);
                }
            );
        });
    }
}
