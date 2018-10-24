var express = require('express'),
    openid = require('openid'),
    //Promise = require('bluebird/js/main/promise')(),
    request = require('request-promise');

var relyingParty, apiKey, useSession = true;
relyingParty = new openid.RelyingParty(
    `${process.env.APPLICATION_URL}/auth/steam/return`,
    `${process.env.APPLICATION_URL}/auth/steam/`,
    true,
    true,
    []
);
apiKey = process.env.STEAM_API_KEY


module.exports.verify = function () {
    return function (req, res, next) {
        relyingParty.verifyAssertion(req, function (err, result) {
            if (err)
                return res.send(err.message);
            if (!result || !result.authenticated)
                return res.send('Failed to authenticate user.');
            if (!/^https?:\/\/steamcommunity\.com\/openid\/id\/\d+$/.test(result.claimedIdentifier))
                return res.send('Claimed identity is not valid.');
            fetchIdentifier(result.claimedIdentifier)
                .then(function (user) {
                    console.log(user)
                    req.session.steamuser = user
                    next();
                })
                .catch(function (err) {
                    res.send(err);
                });

        });
    };
}

module.exports.authenticate = function () {
    return function (req, res, next) {
        relyingParty.authenticate('https://steamcommunity.com/openid', false, function (err, authURL) {
            if (err) {
                console.log(err);
                return next('Authentication failed: ' + err);
            }
            if (!authURL)
                return next('Authentication failed.');
            res.redirect(authURL);
        });
    };
}

function fetchIdentifier(steamID) {
    // our url is http://steamcommunity.com/openid/id/<steamid>
    steamID = steamID.replace('https://steamcommunity.com/openid/id/', '');
    return request('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + apiKey + '&steamids=' + steamID)
        .then(function (res) {
            var players = JSON.parse(res).response.players;
            if (players.length == 0)
                throw new Error('No players found for the given steam ID.');
            var player = players[0];
            return Promise.resolve({
                _json: player,
                steamid: steamID,
                username: player.personaname,
                name: player.realname,
                profile: player.profileurl,
                avatar: {
                    small: player.avatar,
                    medium: player.avatarmedium,
                    large: player.avatarfull
                }
            });
        });
}

function logout(req) {
    return function () {
        delete req.session.steamUser;
        req.user = null;
    }
}