var path = require('path'),
    routes = require('./routes'),
    exphbs = require('express3-handlebars'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    morgan = require('morgan'),
    methodOverride = require('method-override'),
    errorHandler = require('errorhandler'),
    jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens;

var http = require('http');
var swaggerTools = require('swagger-tools');
var jsyaml = require('js-yaml');
var fs = require('fs');    


    

module.exports = function(app) {

  

    // swaggerRouter configuration
    var options = {
      swaggerUi: '/swagger.json',
      controllers: './swagger_controllers',
      useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
    };

    // The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
    var spec = fs.readFileSync('./swagger_api/swagger.yaml', 'utf8');
    var swaggerDoc = jsyaml.safeLoad(spec);

    // Initialize the Swagger middleware
    swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
      // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
      app.use(middleware.swaggerMetadata());

      // Validate Swagger requests
      app.use(middleware.swaggerValidator());

      // Route validated requests to appropriate controller
      app.use(middleware.swaggerRouter(options));

      // Serve the Swagger documents and Swagger UI
      app.use(middleware.swaggerUi());

    });  


    app.engine('handlebars', exphbs.create({
        defaultLayout: 'main',
        layoutsDir: app.get('views') + '/layouts',
        partialsDir: [app.get('views') + '/partials'],
        
    }).engine);
    app.set('view engine', 'handlebars');

    app.use(morgan('dev'));
    
    app.use(bodyParser.urlencoded({
      extended: true,
      uploadDir:path.join(__dirname, 'public/upload/temp')
    }));

    app.use(bodyParser.json());

    app.use(methodOverride());
    
    app.use(cookieParser('some-secret-value-here'));
    
    routes.initialize(app, new express.Router());

    
    app.use('/public/', express.static(path.join(__dirname, '../public')));

    if ('development' === app.get('env')) {
    
        app.use(errorHandler());
    }

    return app;
};
