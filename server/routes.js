var express = require('express'),
	jwt = require('jsonwebtoken'),
	globalConfig = require('../config/global'),
	home = require('../v0/controllers/home'),
	AtlassianCrowd = require('atlassian-crowd'),
	crowd = new AtlassianCrowd(globalConfig.crowdOptions);


/**
*  user controller for api
*/
var v0_user = require('../v0/controllers/user'),
    v0_device = require('../v0/controllers/device');
    
/**
* Here we are going to setup 2 kind of roues
* /v0 routes for version 0 webservices which will be used by mobile team
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
                router.post('/v0/user/forgot-password', v0_user.forgot_password);
                

		app.use('/', router);
    


    /**
    * Setting up a middleware for v0 version api used by mobile team
    * 
    */
	    authenticateApiRouter.get('/', function(req, res) {
		  return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });   
		});
    	authenticateApiRouter.use(function(req, response, next) {

  	      // check header or url parameters or post parameters for token
  	      var token = req.body.token || req.query.token || req.headers['x-access-token'];

  	      if (token) {
                  crowd.session.authenticate(token, function (err, res) {
                    if(err) {
                      response.status(globalConfig.response_status.unauthorized).json({ success: false, message: 'Failed to authenticate token.', error: err.type });
                    }
                    else {
                      req.email = res.user.name;
                      next();
                    }
                  });
  	      } else {
  	        // if there is no token so return an error
  	        return response.status(globalConfig.response_status.forbidden).send({
  	            success: false, 
  	            message: 'No token provided.'
  	        });
  	      }
	      	      
	    });    

        authenticateApiRouter.post('/user/onboard_process', v0_user.onboard_process);
        authenticateApiRouter.post('/user/get-verification-code', v0_user.get_verification_code);
        authenticateApiRouter.post('/user/verify-mobile', v0_user.verify_mobile_no);
        authenticateApiRouter.post('/user/change-password', v0_user.change_password);
        authenticateApiRouter.post('/device/log-events', v0_device.device_logs);
        authenticateApiRouter.get('/user', v0_user.user_details);
        authenticateApiRouter.get('/user/devices', v0_device.user_devices);
        authenticateApiRouter.post('/user/sync/pull', v0_user.sync_pull);
        app.use('/v0', authenticateApiRouter);

};
