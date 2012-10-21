var ignition = ['\n\n\n    )                               \n\
 ( /(          )     (              \n\
 )\\())      ( /(     )\\    (   (    \n\
((_)\\   (   )\\()) ((((_)(  )\\  )(   \n\
 _((_)  )\\ (_))/   )\\ _ )\\((_)(()\\  \n\
| || | ((_)| |_    (_)_\\(_)(_) ((_) \n\
| __ |/ _ \\|  _|    / _ \\  | || \'_| \n\
|_||_|\\___/ \\__|   /_/ \\_\\ |_||_|   \n\
                                    \n\n'];


/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes/hotair')
  , http = require('http')
  , path = require('path')
  , nano = require('nano')
  , useragent = require('useragent')
  , fs = require('fs')
  , cronJob = require('cron').CronJob;


// Cron Job to go grab new tweets every 5 minutes.
new cronJob('0 */12 * * * *', function(){
    console.log('CRON - fetching tweets.');
    routes.fetch_tweets();
}, null, true, "America/New_York");;

var app = express();


var npm_package = JSON.parse(fs.readFileSync('package.json'));
console.log("npm_package", npm_package);
console.log(ignition[0]);


app.locals.app_version = npm_package.version;

// var auth = express.basicAuth('notion', 'Madi50nW1'); 
var auth = express.basicAuth(function(username, password) {
  var valid_logins = {
    'notion': 'Madi50nW1',
    // comment the following out when priv beta is over
    // 'privatealpha1': 'B!denVsRyan', // jason
    // 'privatealpha2': 'B!denVsRyan', // andy
    // 'privatealpha3': 'B!denVsRyan', // michael
    // 'privatealpha4': 'B!denVsRyan', // candice
    // 'privatealpha5': 'B!denVsRyan', // jon
  }
  
  if(typeof valid_logins[username]   === 'string' && valid_logins[username] === password) {
    console.log("basicAuth login ", username, password);
    return true;
  } else return false;
  
})


app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('hotair'));
  app.use(express.session({secret: 'hotair'}));
  app.use(express.csrf());
  app.use(app.router);
  app.use(express.favicon(path.join(__dirname, '/public/favicon.ico')));
  app.use(express.static(path.join(__dirname, 'public'), {maxAge:  86400000}));

});

// configure dev-specific settings
app.configure('development', function(){
  app.use(express.errorHandler());
  app.locals.pretty = true;
  app.locals.env = 'dev';
});

// configure production-specific settings
app.configure('production', function(){
	app.locals.env = 'prod';
});

// simple middleware, could be moved to separate file
function csrf(req, res, next) {
	console.log(req.session);
  res.locals.token = req.session._csrf;
  next();
}

// simple middleware for useragent detection
function agent(req, res, next) {
	if(!(useragent.is(req.headers['user-agent']).chrome || useragent.is(req.headers['user-agent']).safari || useragent.is(req.headers['user-agent']).firefox)
		|| useragent.is(req.headers['user-agent']).mobile_safari) {
		res.redirect('/notsupported');
	} else next();
}


app.get('/', agent, csrf, routes.home);
app.get('/play', agent, csrf, routes.play);
app.get('/score/:id', routes.score);
app.get('/notsupported', routes.notsupported);
app.get('/newsletter', routes.newsletter)
// app.get('/survey', auth, routes.survey);
// app.get('/privatealpha', auth, routes.privatealpha);
// app.get('/privatealpha', routes.alphacomplete); // use this when priv alpha is over

// share services
app.get('/share/:action/:service/:id', routes.share);
app.get('/share/:service', routes.share);
app.get('/share', routes.share);

// contact form
app.get('/contact', csrf, routes.contact);
app.post('/contact/send', routes.contact_send);

// gameplay-related endpoints
app.get('/fetch_tweets', routes.fetch_tweets);
app.get('/all', routes.all);
app.get('/democrats', routes.democrats);
app.get('/republican', routes.republican);
app.get('/load_tweets', routes.load_tweets);
app.get('/highscores', routes.highscores);

// other POST endpoints
app.post('/highscore', routes.highscore);
app.post('/data', routes.data);

// app.get('/*', routes.notfound);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
  console.log("env: ", app.get('env'));
});
