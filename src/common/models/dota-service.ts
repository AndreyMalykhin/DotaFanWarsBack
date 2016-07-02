const JSONbig = require('json-bigint');
import debug = require('debug');
import fetch = require('isomorphic-fetch');

const log = debug('dfw:DotaService');
const JSON = JSONbig({'storeAsString': true});

export interface GetLiveLeagueGamesResponse {
    result: {
        status: number;
        games: GetLiveLeagueGamesResponse.Game[];
    };
}

export namespace GetLiveLeagueGamesResponse {
    export interface Team {
        team_id: string;
        team_name: string;
        team_logo: string;
    }

    export interface Side {
        score: number;
    }

    export interface Game {
        league_id: string;
        radiant_team?: Team;
        dire_team?: Team;
        scoreboard?: {
            radiant: Side;
            dire: Side;
        }
    }
}

export interface GetUGCFileDetailsResponse {
    data: {
        filename: string;
        url: string;
        size: number;
    };
    status?: {
        code: number
    };
}

export default class DotaService {
    private productId = 570;
    private dotaResource = `IDOTA2Match_${this.productId}`;

    constructor(private apiKey: string,
        private apiUrl = 'http://api.steampowered.com') {}

    getLiveLeagueGames(): Promise<GetLiveLeagueGamesResponse> {
        return this.fetch(this.dotaResource, 'GetLiveLeagueGames');
    }

    getUGCFileDetails(id: string): Promise<GetUGCFileDetailsResponse> {
        console.assert(Boolean(id));
        return this.fetch('ISteamRemoteStorage', 'GetUGCFileDetails',
            `appid=${this.productId}&ugcid=${id}`);
    }

    private fetch(
        resource: string, method: string, query?: string, options?: RequestInit
    ): Promise<any> {
        query = `?key=${this.apiKey}${query ? `&${query}` : ''}`;
        const url = `${this.apiUrl}/${resource}/${method}/v1/${query}`;
        return fetch(url, options)
            .then((response) => response.text())
            .then((response) => {
                response = JSON.parse(response);
                log('fetch(); url=%o; response=%o', url, response);
                return response;
            });
    }
}
