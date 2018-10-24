var express = require('express');
var path = require('path')
var router = express();
require('dotenv').config('./.env')
const env = process.env
const bodies = require('body-parser')
const mongoose = require('mongoose')
var exphbs  = require('express-handlebars');
var dev = process.env.NODE_ENV == "development"
const Discord = require('./server/auth/discord')
var config = {
    router,
    env: process.env.NODE_ENV,
    dev
}
router.engine('hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}))
router.set('view engine', 'hbs');

router.use(express.static('public'))

router.use(bodies.urlencoded({
    extended: true
}))
router.use(bodies.json())
require('./server/auth/auth.js')(config)

if (!process.env.MONGO_URL) throw new Error('MISSING ENV VARIABLE [MONGO_URL]')
mongoose.connect(env.MONGO_URL, {
    useNewUrlParser: true
})
mongoose.connection.once('open', function () {
    router.listen(3000, function () {
        console.log('FiveHammer listening on port 3000.')
        Discord.startUpdate()
    });
})