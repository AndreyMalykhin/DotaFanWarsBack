import Bottle = require('bottlejs');
import express = require('express');
import HttpStatus = require('http-status-codes');
import MatchService from '../../common/models/match-service';
import ApiResponse from '../../common/utils/api-response';
import Team from '../../common/models/team';
import Match from '../../common/models/match';

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.get('/', (req, res, next) => {
        // TODO
        const itemsPerPage = 4;
        const matchService: MatchService = (<any> diContainer).matchService;
        matchService.count().exec()
            .then((matchCount) => {
                if (matchCount <= 0) {
                    return Promise.all([[], matchCount]);
                }

                const promise = matchService.getAll()
                    .sort('-id')
                    .skip(Math.max((req.query.page - 1) * itemsPerPage, 0))
                    .limit(itemsPerPage)
                    .populate('radiant.team dire.team')
                    .exec();
                return Promise.all([promise, matchCount]);
            })
            .then(([matches, matchCount]) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: {
                        items: matches.map(transformMatch),
                        pageCount: Math.ceil(matchCount / itemsPerPage)
                    }
                });
            }, (error) => {
                next(error);
            });
    });
    return controller;
}

function transformTeam(team: Team) {
    const {id, name, logoUrl} = team;
    return {
        id: id,
        name: name,
        logoUrl: logoUrl
    };
}

function transformMatch(match: Match) {
    const {startDate, id, radiant, dire} = match;
    return {
        id: id,
        startDate: startDate,
        teams: [
            transformTeam(<Team> radiant.team),
            transformTeam(<Team> dire.team)
        ]
    };
}
