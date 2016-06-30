import {GetLiveLeagueGamesResponse} from '../models/dota-service';

export function filterInterestingGames(
    games: GetLiveLeagueGamesResponse.Game[]) {
    return games.filter((game) => {
        const faceitLeagueId = '4122';
        return game.radiant_team != null
            && game.dire_team != null
            && game.league_id != faceitLeagueId;
    });
}
