const passport = require('passport')
const mongoose = require('mongoose')
const path = require('path')
const request = require('request-promise')
const fs = require('fs')
const openid = require('openid')
const steamLogin = require('./auth/steam.js')
const Discord = require('./auth/discord.js')

function makeid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let text = ''
    for (let i = 0; i < 50; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length))

    return text
}

module.exports = cfg => {
    const {
        router
    } = cfg
    router.get('/auth/verify', (req, res) => {
        const token = req.query.token
        const email = req.query.email

        mongoose.model('User').findOneAndUpdate({
            email,
            token
        }, {
            verified: true,
            token: void 0
        }, (err, result) => {

            if (typeof result === void 0 || result === null || err) {
                return res.redirect('/?message=Invalid%20verification')
            }
            //console.log(result)
            res.redirect('/?verified&message=Account%20verified')
        })
    })

    router.post('/login', (req, res, next) => {
        if (!req.isAuthenticated()) {
            const reject = (message = 'Invalid username or password') => {
                if (req.headers.accept === 'application/json')
                    res.json({
                        session: null,
                        message
                    })
                else {
                    res.redirect('/')
                }
            }

            passport.authenticate('local', function (err, user /*, info */ ) {
                if (err || !user) {
                    //console.log(err)
                    reject()
                } else req.logIn(user, function (err) {
                    if (!err) {
                        //console.log("YES!!!")
                        res.redirect('/home')
                    } else {
                        //console.log(err)
                        reject()
                    }
                })
            })(req, res, next)
        } else res.redirect('/home')
    })
    router.get('/', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/home')
        } else {
            res.render('index');
        }
    })
    router.get('/login', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/home')
        } else {
            res.render('login');
        }
    })
    router.get('/register', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/home')
        } else {
            res.render('register');
        }
    })
    router.post('/register', (req, res, next) => {
        const User = mongoose.model('User')
        const user = new User({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            token: makeid(),
            isAdmin: false // FIXME
        })
        if (!req.isAuthenticated()) {
            user.save((err) => {
                if (err) console.error(err);
                res.redirect('/?success=true')
            })
        } else next()
    })
    router.get('/home', IsReqAuthenticated, (req, res) => {
        const User = mongoose.model('User')
        var results;
        if (req.query.search) {
            var re = new RegExp(req.query.search, "i")
            User.find({username : { $regex: re, $options: 'ix' }},(err,result)=>{
                if (err || !result) console.error(err);
                //console.log("HIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII")
                //console.log(result)
                for (let index = 0; index < result.length; index++) {
                    if (result[index].followers.includes(req.user.email) && req.user.email != result[index].email) result[index].followtext = "Unfollow"
                    else if (req.user.email == result[index].email) result[index].followtext = "<span class='text-muted'>You can't follow yourself.</span>"
                    else result[index].followtext = ""
                    
                }
                results = result;
                res.render('home', {
                    user: req.user,
                    layout: 'authenticated',
                    results:results,
                });
            })
        }
        
    })
    router.get('/my-account', IsReqAuthenticated, (req, res) => {
        var encodedDiscord = encodeURIComponent(`Discord_${req.user.discord.username}`)
        var encodedSteam = encodeURIComponent(req.user.steam)
        res.render('myaccount', {
            user: req.user,
            encodedDiscord: encodedDiscord,
            href: `${process.env.APPLICATION_URL}/auth/steam`,
            encodedSteam: encodedSteam,
            layout: 'authenticated'
        });
    })
    router.get('/user/:email', IsReqAuthenticated, (req,res)=>{
        const User = mongoose.model('User')
        User.findOne({email:req.params.email}, async (err,result)=>{
            if (err || !result) return res.json({status:404, error:err || "user not found."})
            if (result.discord.username != "") {
                var encodedDiscord = encodeURIComponent(`Discord_${req.user.discord.username}`)
                for (let index = 0; index < result.follows.length; index++) {
                    await mongoose.model('User').findOne({email:result.follows[index]},(err,r)=>{
                        result.follows[index] = r
                    })
                }
                for (let index = 0; index < result.followers.length; index++) {
                    await mongoose.model('User').findOne({email:result.followers[index]},(err,r)=>{
                        result.followers[index] = r
                        console.log(r.username)
                    })
                }
                res.render('profile',{
                    user:result,
                    encodedDiscord:encodedDiscord,
                    layout: 'profile'
                })
            } else {
                for (let index = 0; index < result.follows.length; index++) {
                    await mongoose.model('User').findOne({email:result.follows[index]},(err,r)=>{
                        result.follows[index] = r
                    })
                }
                for (let index = 0; index < result.followers.length; index++) {
                    await mongoose.model('User').findOne({email:result.followers[index]},(err,r)=>{
                        result.followers[index] = r
                        console.log(r.username)
                    })
                }
                res.render('profile',{
                    user:result,
                    layout: 'profile'
                })
            }
        })

    })
    router.get('/auth/discord/return', IsReqAuthenticated, Discord.authenticate)
    router.get('/auth/steam', steamLogin.authenticate(), (req, res) => {
        res.json({
            status: 500,
            error: "Authentication failed."
        })
    })
    router.get('/auth/steam/return', steamLogin.verify(), (req, res) => {
        const User = mongoose.model('User')
        User.findOneAndUpdate({
            email: req.user.email
        }, {
            steam: req.session.steamuser.username
        }, (err, result) => {
            if (err) res.json({
                status: 500,
                error: err
            })
            req.user.steam = req.session.steamuser.username;
            req.logIn(req.user, (err) => {
                if (err) res.json({
                    status: 500,
                    error: err
                })
                let options = {
                    uri: req.session.steamuser.avatar.large,
                    encoding: null
                };
                //let url = `https://cdn.discordapp.com/avatars/${userinfos.id}/${userinfos.avatar}.png?size=1024`
                //console.log(url)
                request(options)
                    .then(avatar => {
                        fs.writeFile(path.join(__dirname, '../public/img/', `${req.session.steamuser.username}.jpg`), avatar, (err) => {
                            if (err) return res.json({
                                status: 500,
                                error: err
                            });
                            res.redirect('/my-account')
                        })
    
                    })

            })


        })
    })

    router.get('/user/follow/:email',(req,res)=>{
        const User = mongoose.model('User')
        User.findOneAndUpdate({email:req.params.email},{$addToSet:{followers:req.user.email}},()=>{console.log("done")})
        User.findOneAndUpdate({email:req.user.email},{$addToSet:{follows:req.params.email}},()=>{console.log("done")})
        res.redirect("back")
    })
    router.get('/user/unfollow/:email',(req,res)=>{
        const User = mongoose.model('User')
        User.findOneAndUpdate({email:req.params.email},{$pull:{followers:req.user.email}},()=>{console.log("done")})
        User.findOneAndUpdate({email:req.user.email},{$pull:{follows:req.params.email}},()=>{console.log("done")})
        res.redirect("back")
    })
}

function IsReqAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        next()
    } else {
        res.status(403)
        res.json({
            status: 403,
            message: 'you are not authenticated, please sign in first.'
        })
    }
}