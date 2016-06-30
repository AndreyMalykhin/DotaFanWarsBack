import Bottle = require('bottlejs');
import express = require('express');
import MatchService from '../../common/models/match-service';
import ApiResponse from '../../common/utils/api-response';
import Team from '../../common/models/team';

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    controller.get('/', (req, res) => {
        const itemsPerPage = 4;
        const offset = (req.query.page - 1) * itemsPerPage;
        const matchService: MatchService = (<any> diContainer).matchService;
        const getAllMatchesPromise = matchService.getAll()
            .sort('-id')
            .skip(offset)
            .limit(itemsPerPage)
            .populate('radiant.team dire.team')
            .exec();
        Promise.all([getAllMatchesPromise, matchService.count().exec()])
            .then(([matches, matchCount]) => {
                const items = matches.map((match) => {
                    const {startDate, id, radiant, dire} = match;
                    return {
                        id: id,
                        startDate: startDate,
                        teams: [
                            transformTeam(<Team> radiant.team),
                            transformTeam(<Team> dire.team)
                        ]
                    };
                });
                res.json(<ApiResponse> {
                    status: 200,
                    data: {
                        items: items,
                        pageCount: Math.ceil(matchCount / itemsPerPage)
                    }
                });
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
