var globalConfig = require('../../config/global'),
	deviceModel = require('../models/devices'),
	devicelogsModel = require('../models/devicelogs'),
    async = require('async');
    
module.exports = {

	/**
    * Function will first check device in device table if it does not find then store it their and then store logs in log table
    * @ identifier :- device identifier
    * @ serialNumber :- serial number of device
    * @ deviceName :- name of device
    * @ token:- must be there to retrive email
    * After device and their log it will send success message
    */

    device_logs: function(req, res) {
    	/* Check device in table, if not found store it*/

    	if(!req.body.hasOwnProperty('identifier') || req.body.identifier.trim() ===""){
    	    res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Device Identifier" });
    	    return ;
    	}
    	if(!req.body.hasOwnProperty('serialNumber') || req.body.serialNumber.trim() ===""){
    	    res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Device serial Number" });
    	    return ;
    	}
    	if(!req.body.hasOwnProperty('deviceName') || req.body.deviceName.trim() ===""){
    	    res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Device Name" });
    	    return ;
    	}
    	if(!req.body.hasOwnProperty('logType') || req.body.logType.trim() ===""){
    	    res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Device Log Type" });
    	    return ;
    	}

    	if(globalConfig.device_log_type.indexOf(req.body.logType) === -1){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Device Log Type must be device-detect, device-pair, device-synchronize, error-detect, error-pair or error-synchronize" });
            return ;
        }

    	async.series([
    	    function(next){
    	        // do some stuff ...
    	        deviceModel.getDeviceByIdentifier(req.body.identifier,next);
    	    }
    	],
    	// optional callback
    	function(err, results){

    		if(err){
    		    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "storing device log fail",error_message:JSON.stringify(err, null, 2) });
    		    console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
    		    return ;
    		} 

    		if(results[0].hasOwnProperty("Count") &&  results[0].Count > 0 ){
    			
    			async.series([
    			    function(next1){
    			        // do some stuff ...
    			        module.exports.logDevice(req,res,next1);
    			    }
    			],
    			// optional callback
    			function(err, results){

    				if(err){
    				    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "storing device log fail",error_message:JSON.stringify(err, null, 2) });
    				    console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
    				    return ;
    				} 

    				res.status(globalConfig.response_status.success).json({ success:true, message: "Device log stored successfully"});
    				
    			});    			

    		} else {

				/* First time detected */
				module.exports.registerDevice(req,function(){

					async.series([
					    function(next1){
					        // do some stuff ...
					        module.exports.logDevice(req,res,next1);
					    }
					],
					// optional callback
					function(err, results){

						if(err){
						    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "storing device log fail",error_message:JSON.stringify(err, null, 2) });
						    console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
						    return ;
						} 

						res.status(globalConfig.response_status.success).json({ success:true, message: "device log stored successfuly"});    

					});

				    

				});


    		}

    	});
    	
    },
	/**
    * Function store device in device table, device will be store only one time
    * @ identifier :- device identifier
    * @ serialNumber :- serial number of device
    * @ deviceName :- name of device
    * @ user:- must be there to retrive email
    * After storing device in device table it will call call back function
    */
    registerDevice: function(req, callback){

    	async.series([
    	    function(next){
    	        // do some stuff ...
    	        deviceModel.registerDevice(req,next);
    	    }
    	],
    	// optional callback
    	function(err, results){

    		if(err){
    			res.status(globalConfig.response_status.internal_server_error).json({ success:false, message: "some thing went wrong in storing device" });    
    			return;
    		}
    		callback();
    	});	
    },
    /**
    * Function store device logs
    * @ identifier :- device identifier
    * @ user:- must be there to retrive email
    * @ logType:- must be there to retrive email
    * After storing device in device table it will call call back function
    */
    logDevice: function(req,res, callback){

    	async.series([
    	    function(next){
    	        devicelogsModel.registerLogs(req,next);
    	    }
    	],
    	// optional callback
    	function(err, results){

    		if(err){
    			res.status(globalConfig.response_status.internal_server_error).json({ success:false, message: "some thing went wrong in storing device" });    
    			return;
    		}
    		callback();
    	});	
    },

	/**
	 * Function to get user devices
	 * @ email :- user email
	 */
	user_devices: function(req,res, callback){

		async.series([
				function(next){
					deviceModel.getDeviceByUser(req.email,next);
				}
			],
			function(err, results){

				if(err){
					res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Error in fetching user devices.",error_message:JSON.stringify(err, null, 2) });
					return;
				} else {
					if(results[0].Items.length){
						res.status(globalConfig.response_status.success).json({ success:true, devices: results[0].Items});
						return;
					}else{
						res.status(globalConfig.response_status.success).json({ success:true, message: "No devices found",devices: results[0].Items});
						return;
					}
				}

			});
	}

};
