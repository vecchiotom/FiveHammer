const mongoose = require('mongoose')
const path = require('path')
const request = require('request-promise')
const fs = require('fs')

module.exports.authenticate = (req, res, next) => {
    const User = mongoose.model('User')
    var discordapi;
    let options = {
        method: 'POST',
        uri: 'https://discordapp.com/api/oauth2/token',
        formData: {
            client_id: process.env.DISCORD_APP_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: req.query.code,
            redirect_uri: `${process.env.APPLICATION_URL}/auth/discord/return`,
            scope: 'identify'
        },
        json: true // Automatically stringifies the body to JSON
    };
    request(options)
        .then((data) => {
            discordapi = data
            let options = {
                uri: 'https://discordapp.com/api/users/@me',
                headers: {
                    'Authorization': `Bearer ${discordapi.access_token}`
                },
                json: true // Automatically parses the JSON string in the response
            };
            request(options)
                .then((userinfos) => {
                    User.findOneAndUpdate({
                        email: req.query.state
                    }, {
                        discord: {username : `${userinfos.username}#${userinfos.discriminator}`, access_token: discordapi.access_token, refresh_token: discordapi.refresh_token}
                    }, (err, result) => {
                        if (err) return res.json({
                            status: 500,
                            error: err
                        });
                        req.user.discord = {username : `${userinfos.username}#${userinfos.discriminator}`, access_token: discordapi.access_token, refresh_token: discordapi.refresh_token}
                        req.logIn(req.user, function (error) {
                            if (!error) {
                                let options = {
                                    uri: `https://cdn.discordapp.com/avatars/${userinfos.id}/${userinfos.avatar}.png?size=1024`,
                                    encoding: null
                                };
                                //let url = `https://cdn.discordapp.com/avatars/${userinfos.id}/${userinfos.avatar}.png?size=1024`
                                //console.log(url)
                                request(options)
                                    .then(avatar => {
                                        fs.writeFile(path.join(__dirname, '../../public/img/', `Discord_${userinfos.username}#${userinfos.discriminator}.png`), avatar, (err) => {
                                            if (err) return res.json({
                                                status: 500,
                                                error: err
                                            });
                                            res.redirect('/my-account')
                                        })

                                    })
                            }
                        });

                    })
                })
        })
}

module.exports.startUpdate = () => {
    UpdateUsers()
    setInterval(UpdateUsers, 900000)
}

const UpdateUsers = () => {
    const User = mongoose.model('User')
    User.find({}, (err, users) => {
        users.forEach(user => {
            if (user.discord.refresh_token != "") {
                let options = {
                    method: 'POST',
                    uri: 'https://discordapp.com/api/oauth2/token',
                    formData: {
                        client_id: process.env.DISCORD_APP_ID,
                        client_secret: process.env.DISCORD_CLIENT_SECRET,
                        grant_type: 'refresh_token',
                        refresh_token: user.discord.refresh_token,
                        redirect_uri: `${process.env.APPLICATION_URL}/auth/discord/return`,
                        scope: 'identify'
                    },
                    json: true // Automatically stringifies the body to JSON
                };
                request(options)
                    .then((data) => {
                        let options = {
                            uri: 'https://discordapp.com/api/users/@me',
                            headers: {
                                'Authorization': `Bearer ${data.access_token}`
                            },
                            json: true // Automatically parses the JSON string in the response
                        };

                        request(options)
                            .then((discorduser) => {
                                User.findOneAndUpdate({
                                    email: user.email
                                }, {
                                    discord: {
                                        access_token: data.access_token,
                                        refresh_token: data.refresh_token,
                                        username: `${discorduser.username}#${discorduser.discriminator}`
                                    }
                                }, (err, res) => {
                                    if (err) return console.error(err);
                                    let options = {
                                        uri: `https://cdn.discordapp.com/avatars/${discorduser.id}/${discorduser.avatar}.png?size=1024`,
                                        encoding: null
                                    };
                                    //let url = `https://cdn.discordapp.com/avatars/${userinfos.id}/${userinfos.avatar}.png?size=1024`
                                    //console.log(url)
                                    request(options)
                                        .then(avatar => {
                                            fs.renameSync(path.join(__dirname, '../../public/img/', `Discord_${res.discord.username}.png`),path.join(__dirname, '../../public/img/',`Discord_${discorduser.username}#${discorduser.discriminator}.png`))
                                            fs.writeFile(path.join(__dirname, '../../public/img/', `Discord_${discorduser.username}#${discorduser.discriminator}.png`), avatar, (err) => {
                                                if (err) return console.error(err);
                                                //res.redirect('/my-account')
                                                
                                            })

                                        })

                                })
                            })
                    })
            }

        });
    })
}