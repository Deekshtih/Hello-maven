var express = require('express'),
	jwt = require('jsonwebtoken'),
	globalConfig = require('../config/global'),
	home = require('../v0/controllers/home');


/**
*  Copy is only used for node developer only, so that mobile team can test while working
*/
var v0_user = require('../v0/controllers/user');
    
/**
*  Copy is only used for mobile developer
*/    

var vLocal_user = require('../vLocal/controllers/user');


/**
* Here we are going to setup 3 kind of roues
* /v0 routes for version 0 webservices which will be used by mobile team
* /vLocal routes which for only Nodejs developer for testing and development perpose
*/

module.exports.initialize = function(app, router) {

	var authenticateApiRouter =  new express.Router(),
	    authenticateApiRouterLocal = new express.Router();


	/**
    * Setting up a Router for non authentication url
    * 
    */    
		router.get('/', home.index);

		/* non authentication route for mobile team */
		router.post('/v0/user/authenticate', v0_user.authenticate);
		router.post('/v0/user/registration', v0_user.authenticate);

        /* non authentication route for node js team team */
        router.post('/vLocal/user/authenticate', v0_user.authenticate);
        router.post('/vLocal/user/registration', v0_user.authenticate);


		app.use('/', router);
    


    /**
    * Setting up a middleware for v0 version api used by mobile team
    * 
    */
	    authenticateApiRouter.get('/', function(req, res) {
		  return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });   
		});
    	authenticateApiRouter.use(function(req, res, next) {

	      // check header or url parameters or post parameters for token
	      var token = req.body.token || req.query.token || req.headers['x-access-token'];

	      // decode token
	      if (token) {

	        // verifies secret and checks exp
	        jwt.verify(token, globalConfig.token.token_private_key, function(err, decoded) {      
	          if (err) {
	            return res.status(globalConfig.response_status.unauthorized).json({ success: false, message: 'Failed to authenticate token.' });    
	          } else {
	            // if everything is good, save to request for use in other routes
	            req.decoded = decoded;    
	            next();
	          }
	        });

	      } else {

	        // if there is no token
	        // return an error
	        return res.status(globalConfig.response_status.forbidden).send({ 
	            success: false, 
	            message: 'No token provided.' 
	        });
	        
	      }
	    });    
	    
        authenticateApiRouter.post('/user/onboard_process', v0_user.onboard_process);        
        authenticateApiRouter.post('/user/get-verification-code', v0_user.get_verification_code);
        authenticateApiRouter.post('/user/verify-mobile', v0_user.verify_mobile_no);
	    app.use('/v0', authenticateApiRouter);



    /**
	* Setting up a middleware for Local testing version api
	* 
	*/  
	    authenticateApiRouterLocal.get('/', function(req, res) {
		  return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });   
		});
    	authenticateApiRouterLocal.use(function(req, res, next) {

	      // check header or url parameters or post parameters for token
	      var token = req.body.token || req.query.token || req.headers['x-access-token'];
	      
	      // decode token
	      if (token) {

	        // verifies secret and checks exp
	        jwt.verify(token, globalConfig.token.token_private_key, function(err, decoded) {      
	          if (err) {
	            return res.status(globalConfig.response_status.unauthorized).json({ success: false, message: 'Failed to authenticate token.' });    
	          } else {
	            // if everything is good, save to request for use in other routes
	            req.decoded = decoded;    
	            next();
	          }
	        });

	      } else {

	        // if there is no token
	        // return an error
	        return res.status(globalConfig.response_status.forbidden).send({ 
	            success: false, 
	            message: 'No token provided.' 
	        });
	        
	      }
	    });    
    	
        authenticateApiRouterLocal.post('/user/onboard_process', vLocal_user.onboard_process);
        authenticateApiRouterLocal.post('/user/get-verification-code', vLocal_user.get_verification_code);
        authenticateApiRouterLocal.post('/user/verify-mobile', vLocal_user.verify_mobile_no);
    	app.use('/vLocal', authenticateApiRouterLocal);

};
