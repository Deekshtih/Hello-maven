var userModel = require('../models/users'),
    globalConfig = require('../../config/global'),
    async = require('async'),
    jwt = require('jsonwebtoken'),
    commonHelper = require('../helpers/common'),
    authy = require('authy')(globalConfig.authy_key),
    AtlassianCrowd = require('atlassian-crowd'),
    crowd = new AtlassianCrowd(globalConfig.crowdOptions),
    nodemailer = require('nodemailer');

module.exports = {

    /**
    * Function is been created for authenticating user for native login
    * @ email :- email address of user
    * @ password :- password of user
    * After Authenticating it will generate token
    */
    
    native_login: function(request, response) {
      var email = request.body.email;
      var password = request.body.password;
      crowd.user.authenticate(email, password, function (err, res) {
        if(err) {
          response.status(globalConfig.response_status.not_found).json({ success:false, error: 'Authentication failed', error_message: err.type });
        }
        else {
          crowd.session.create(email, password, function (err, token) {
            if(err) {
              response.status(globalConfig.response_status.unauthorized).json({ success:false, error: 'Authentication failed', error_message: err.type });
            }
            else {
              response.status(globalConfig.response_status.success).json({ success:true, message: "User is authenticated", token:token });    
            }
          });
        }
      });
    },

    /**
    * Function is been created for registering native user in dynamoDB
    * @ email :- email address of user
    * @ password :- password of user
    * @ monthly_reveal_report:- true/false
    * @ promotional_offers_lifescan:- true/false
    * It will first verify username, If it does exists then return error message
    */
    native_registration: function(request, response){

        var email = request.body.email;

        /*To check if user exist or not*/
        crowd.user.find(email,function(findErr,findRes){
            var executeFlag =false;
            if(findErr){

                /* If no user found then create user*/
                if(findErr.type==='USER_NOT_FOUND'){
                    executeFlag =true;
                }else{
                    response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(findErr.type, null, 2) });
                }

            }else{

                /* If email exists*/
                if(findRes!==undefined){
                    response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Email already exists" });
                }else{
                    executeFlag =true;
                }

            }

            /* Code to add user in crowd*/
            if(executeFlag){

                crowd.user.create('User', '', '', request.body.email, request.body.email, request.body.password, function(createErr,createRes){

                    if(createErr){
                        response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(createErr.type, null, 2) });
                    }else{

                        /* Code to add user in dynamodb*/
                        userModel.registerUser(request,function(dynamoErr,dynamoRes){
                            if(dynamoErr){

                                /*if there is an error while storing user in dynamodb delete user from crowd*/
                                crowd.user.remove(email, function(removeErr) {
                                    if(removeErr){
                                        response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(removeErr.type, null, 2) });
                                        return ;
                                    }
                                });
                                
                            }else{

                                /* Login After registration */
                                crowd.user.authenticate(request.body.email, request.body.password, function (err, res) {
                                    if(err) {
                                      response.status(globalConfig.response_status.not_found).json({ success:false, error: 'Authentication failed', error_message: err.type });
                                    }
                                    else {
                                      crowd.session.create(request.body.email, request.body.password, function (err, token) {
                                        if(err) {
                                          response.status(globalConfig.response_status.unauthorized).json({ success:false, error: 'Authentication failed', error_message: err.type });
                                        }
                                        else {
                                          response.status(globalConfig.response_status.created).json({ success:true, message: "User Added Successfully", token:token });
                                        }
                                      });
                                    }
                                });


                            }

                        });
                    }

                });
            }

        });

    },

    /**
    * Function will generate token based on user
    * @ userObj :- It is a user object must contain email and password
    * 
    */
    generateStoreToken: function(userObj, callback) {

        /* Generating Token */
        var uObj={};
        uObj.email = userObj.email;
        uObj.password = userObj.password;

        var token  = userModel.generatToken(uObj);
        var expiretime = new Date().getTime() + globalConfig.token.expiration_period.milliseconds; // set to one hour
        
        async.series([
            function(next){
                userModel.storeToken(uObj,token,expiretime,next);
            }
        ],
        function(err, results){
            
            if(err){
                res.status(globalConfig.response_status.internal_server_error).json({ success:false, message: "some thing went wrong in storing token" });    
                return ;
            } 
            callback(token);
        });
    },

    /**
    *  Roal of facebook_authenticate function is to perform login and registration task.
    *  mobile team has to give two parameters 
    *  @email which is compulsory
    *  @fb_content which is an object contains rest of information given by fb api 
    */
    facebook_authenticate: function(req, res) {

        

        /* Check user email in DB */
        async.series([
            function(next){
                // do some stuff ...
                userModel.getUserByEmail(req.body.email,next);
            }
        ],
        // optional callback
        function(err, results){

            if(err){
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(err, null, 2) });
                return ;
            }
            
            if(results[0].hasOwnProperty("Count") &&  results[0].Count > 0 ){
            
                /* Email Already Exists, So Just update info*/
                
                try{

                var userObj = results[0].Items[0];

                    var fb_content ={};
                    if(req.body.hasOwnProperty('fb_content') && typeof(req.body.fb_content) === "object"){
                        fb_content = req.body.fb_content;
                    }
                    if(req.body.hasOwnProperty('fb_content') && typeof(req.body.fb_content) === "string"){
                        fb_content = JSON.parse(req.body.fb_content);
                    }

                } catch(err) {
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "User is not Authenticated, error while fetching data",error_message:JSON.stringify(err, null, 2)});
                    return ;
                }
                
                var updateObject ={
                    fb_content:fb_content
                };

                async.series([
                    function(next){
                        userModel.updateItem(userObj,updateObject,next);
                    }
                ],
                // optional callback
                function(err, results){
                    if(err){
                        res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration/login fail",error_message:JSON.stringify(err, null, 2) });
                        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                        return ;
                    } 

                    /*user register successfull */
                    
                    /* Generating Token */
                    module.exports.generateStoreToken(userObj,function(token){
                        res.status(globalConfig.response_status.success).json({ success:true, message: "User is Authenticated",token:token });    
                    });
                });

            } else {

                /* Register New User */
                try{


                    var monthly_reveal_report=false;
                    if(req.body.hasOwnProperty('monthly_reveal_report') && typeof(req.body.monthly_reveal_report) === "boolean"){
                        monthly_reveal_report = req.body.monthly_reveal_report;
                    }

                    var promotional_offers_lifescan=false;
                    if(req.body.hasOwnProperty('promotional_offers_lifescan') && typeof(req.body.promotional_offers_lifescan) === "boolean"){
                        promotional_offers_lifescan = req.body.promotional_offers_lifescan;
                    }

                    var fb_content ={}
                    if(req.body.hasOwnProperty('fb_content') && typeof(req.body.fb_content) === "object"){
                        fb_content = req.body.fb_content;
                    }
                    if(req.body.hasOwnProperty('fb_content') && typeof(req.body.fb_content) === "string"){
                        fb_content = JSON.parse(req.body.fb_content);
                    }

                    var userObj = {
                        email:req.body.email,
                        fb_content:fb_content,
                        promotional_offers_lifescan:promotional_offers_lifescan,
                        monthly_reveal_report:monthly_reveal_report,
                        password:userModel.generateHash('temp')
                    }

                } catch(err) {
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "User is not Authenticated, error while fetching data",error_message:JSON.stringify(err, null, 2)});
                    return ;
                }

                /**
                    Call For registering user in DB
                */
                async.series([
                    function(next){
                        userModel.registerFbUser(userObj,next);
                    }
                ],
                // optional callback
                function(err, results){
                    if(err){
                        res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(err, null, 2) });
                        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                        return ;
                    } 
                    /*user register successfull */
                    /* Generating Token */
                    module.exports.generateStoreToken(userObj,function(token){
                        res.status(globalConfig.response_status.success).json({ success:true, message: "User is Authenticated",token:token });    
                    });
                });
            }            
        });

        
    },

    /**
    *  Authenticate is master function of 3 sub function
    *  It will perform native_login, native_signup, facebook(login and signup)
    */
    authenticate: function(req, res) {
        
        var actionTypeArr = ["native_login", "native_register", "facebook"];

        if(!req.body.hasOwnProperty('action_type') || req.body.action_type.trim() ===""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Action Type" });
            return ;
        } else if(actionTypeArr.indexOf(req.body.action_type) === -1){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Action type should be native_login, native_register or facebook" });
            return ;
        }



        /* validate if email address not empty, email address is compulsory for all 3 action type */
        if(!req.body.hasOwnProperty('email') || req.body.email.trim() ===""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Email" });
            return ;
        } else if(!commonHelper.validateEmail(req.body.email)){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Proper User Email" });
            return ;
        }


        if(req.body.action_type === "native_register" || req.body.action_type === "native_login") {

            /* Password is compulsory for native_register and native_login action type*/
            if(!req.body.hasOwnProperty('password') || req.body.password.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Password" });
                return ;
            }
        }
        
        if(req.body.action_type === "native_register") {
          if(!commonHelper.validatePassword(req.body.password)){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Password must contain atleast 1 character, 1 number and should be of minimum 8 characters and maximum of 16 characters. " });
            return ;
          }
        }
        
        switch(req.body.action_type)
        {
            case 'native_login':
                /* Code is written for native login*/

                module.exports.native_login(req, res);

            break;

            case 'native_register':

                module.exports.native_registration(req, res);

            break;

            case 'facebook':

                module.exports.facebook_authenticate(req, res);

            break;
        }
    },
    /**
    * To send a verification_code to the provided no
    * @country :- Country code
    * @mobile_no :- Mobile no
    */
    get_verification_code: function(req, res) {
        if(!req.body.hasOwnProperty('country') || req.body.country.trim() === ""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Country" });
            return ;
        } else if(!globalConfig.countries.hasOwnProperty(req.body.country)){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Country must be US or CA" });
            return ;
        }

        if(!req.body.hasOwnProperty('mobile_no') || req.body.mobile_no.trim() === ""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide mobile number" });
            return ;
        } 
        
        var country = globalConfig.countries[req.body.country];
        var mobile_no = req.body.mobile_no;
        
        authy.phones().verification_start(mobile_no, country, { via: 'sms' }, function(err, mRes) {
          if(mRes && typeof mRes.success !== "undefined") {
            res.status(globalConfig.response_status.success).send({ success:true, message: mRes.message });
          } else {
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: err.message });
          }
        });
    },
   /**
    * To verify an mobile no
    * @country :- Country code
    * @mobile_no :- Mobile no
    * @verification_code:- verification code
    */
    
    verify_mobile_no:function(req, res) {
      if(!req.body.hasOwnProperty('country') || req.body.country.trim() === ""){
        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Country" });
        return ;
      } else if(!globalConfig.countries.hasOwnProperty(req.body.country)){
        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Country must be US or CA" });
        return ;
      }
      if(!req.body.hasOwnProperty('mobile_no') || req.body.mobile_no.trim() === ""){
        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide mobile no" });
        return ;
      } 
      if(!req.body.hasOwnProperty('verification_code') || req.body.verification_code.trim() === ""){
        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide verification code" });
        return ;
      }
      
      var country = globalConfig.countries[req.body.country];
      var mobile_no = req.body.mobile_no; 
      var verification_code = req.body.verification_code;
      
      authy.phones().verification_check(mobile_no, country, verification_code, function (err, mRes) {
        if(mRes && typeof mRes.success !== "undefined") {
          var userObj = {email:req.email};
          var updateObject ={
            "mobile_verified": true,
            "mobile_no": mobile_no,
            "country":country
          };
        
          async.series([
            function(next){
              userModel.updateItem(userObj,updateObject,next);
            }
          ],
          function(err, results){
                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Some error occurred in mobile varification",error_message:JSON.stringify(err, null, 2) });
                    return;
                } else {
                    res.status(globalConfig.response_status.success).send({ success:true, message: mRes.message });
                    return;
                }
            });
        } else {
          res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: err.message });
        }
      });
    },
    /**
     * Function is used to update onboard process fields like date of birth
     */
    onboard_process:function(req, res) {
        var onboardTypeArr = ["date_of_birth", "start_day_time", "diabetes_type", "personality_type", "test_reminders","reveal_reports_and_offers","starlix_medications","glynase_medications"];

        if(!req.body.hasOwnProperty('onboard_type') || req.body.onboard_type.trim() ===""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Onboard Type" });
            return ;
        } else if(onboardTypeArr.indexOf(req.body.onboard_type) === -1){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Onboard type should be date_of_birth, start_day_time, diabetes_type, describe_type, test_reminders, reveal_reports_and_offers, starlix_medications or glynase_medications " });
            return ;
        }


        if(req.body.onboard_type === "date_of_birth" ) {

            /* date of birth field is compulsory for date_of_birth onboard type */
            if(!req.body.hasOwnProperty('date_of_birth') || req.body.date_of_birth.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user date of birth" });
                return ;
            }else if(!commonHelper.validateDate(req.body.date_of_birth)){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Date of birth should be in yyyy-mm-dd format" });
                return ;
            }else if(!commonHelper.validateFutureDate(req.body.date_of_birth)){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "For date of birth, future date is not allowed" });
                return ;
            }

        } else if(req.body.onboard_type === "start_day_time" ) {

            /*  start day time field is compulsory for start_day_time onboard type */
            if(!req.body.hasOwnProperty('start_day_time') || req.body.start_day_time.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide start day time" });
                return ;
            }else if(!commonHelper.validateTime(req.body.start_day_time)){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Start day time should be in 12 hour format (Ex 7:00 AM)"});
                return ;
            }

        } else if(req.body.onboard_type === "diabetes_type" ) {
            /* diabetes type field is compulsory for diabetes_type onboard type */
            if(!req.body.hasOwnProperty('diabetes_type') || req.body.diabetes_type.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide user's diabetes type" });
                return ;
            } else if(!globalConfig.diabetes_types.hasOwnProperty(req.body.diabetes_type)) {
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide an option for a diabetes type i.e send 'opt1' for Type1, 'opt2' for Type2 or 'opt3' for Gestational" });
                return ;
            }
        } else if(req.body.onboard_type === "personality_type" ) {
            /* user describe options type field is compulsory for describe_type onboard type */
            if(!req.body.hasOwnProperty('personality_type') || req.body.personality_type.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide user's personality_type" });
                return ;
            } else if(!globalConfig.describe_options.hasOwnProperty(req.body.personality_type)) {
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide an option for a user's personality type i.e send 'opt1' or 'opt2' or 'opt3'" });
                return ;
            }
        } else if(req.body.onboard_type === "test_reminders" ) {

            /* test_reminders field is compulsory for diabetes_type test_reminders  */

            console.log(req.body.test_reminders);
            if(!req.body.hasOwnProperty('test_reminders') || req.body.test_reminders ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user's test reminders" });
                return ;
            }else{
                var reminderArr =[];
                if(typeof req.body.test_reminders === 'string'){
                    reminderArr.push(req.body.test_reminders)
                }else{
                    reminderArr =req.body.test_reminders;
                }

                for(var i in reminderArr){
                    if(!commonHelper.validateTime(reminderArr[i].trim())){
                        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Test reminders time should be in 12 hour format (Ex 7:00 AM)"});
                        return ;
                    }
                }

                    }

        }else if(req.body.onboard_type === "reveal_reports_and_offers" ) {
            /* user describe options type field is compulsory for describe_type onboard type */
            if(!req.body.hasOwnProperty('monthly_reveal_report') || req.body.monthly_reveal_report.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide monthly reveal report value" });
                return ;
            } else if( req.body.monthly_reveal_report.toLowerCase() !=='true' && req.body.monthly_reveal_report.toLowerCase()!=='false') {
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Monthly reveal report value should be either true or false." });
                return ;
            }

            if(!req.body.hasOwnProperty('promotional_offers_lifescan') || req.body.promotional_offers_lifescan.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide promotional offers value" });
                return ;
            } else if( req.body.promotional_offers_lifescan.toLowerCase() !=='true' && req.body.promotional_offers_lifescan.toLowerCase()!=='false') {
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Promotional offers value should be either true or false." });
                return ;
            }
        }else if(req.body.onboard_type === "starlix_medications" ) {

            /* medication_starlix field is compulsory for medication_starlix onboard type  */
            if(!req.body.hasOwnProperty('starlix_medications') || req.body.starlix_medications.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user's starlix medications" });
                return ;
            }else{
                var medicationArr =[];
                medicationArr =(req.body.starlix_medications).split(',').filter(Boolean);
                for(var i in medicationArr){
                    if(!commonHelper.validateTime(medicationArr[i].trim())){
                        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Starlix medications time should be in 12 hour format (Ex 7:00 AM)"});
                        return ;
                    }
                }

            }

        }else if(req.body.onboard_type === "glynase_medications" ) {

            /* medication_starlix field is compulsory for glynase_medications onboard type  */
            if(!req.body.hasOwnProperty('glynase_medications') || req.body.glynase_medications.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user's glynase medications" });
                return ;
            }else{
                var medicationArr =[];
                medicationArr =(req.body.glynase_medications).split(',').filter(Boolean);
                for(var i in medicationArr){
                    if(!commonHelper.validateTime(medicationArr[i].trim())){
                        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Glynase medications time should be in 12 hour format (Ex 7:00 AM)"});
                        return ;
                    }
                }

            }

        }

        
        switch(req.body.onboard_type)
        {
            case 'date_of_birth':
                module.exports.update_dateofbirth(req.email,req, res);
                break;
            case 'start_day_time':
                module.exports.update_start_day_time(req.email,req, res);
                break;
            case 'diabetes_type':
                module.exports.update_diabetes_type(req.email,req, res);
                break;
            case 'personality_type':
                module.exports.update_describe_type(req.email,req, res);
                break;
            case 'test_reminders':
                module.exports.update_test_reminders(req.email,req, res);
                break;
            case 'reveal_reports_and_offers':
                module.exports.update_reveal_reports_and_offers(req.email,req, res);
                break;
            case 'starlix_medications':
                module.exports.update_starlix_medications(req.email,req, res);
                break;
            case 'glynase_medications':
                module.exports.update_glynase_medications(req.email,req, res);
                break;
  
        }

    },



    /*
     * Function is used to update date of birth field (Onboard process)
     * @ date_of_birth:- date of birth in yyyy-MM-dd format.
     * */
    update_dateofbirth:function(email,req, res){

        var userObj = {email:email};
        var updateObject ={
            "date_of_birth":new Date(req.body.date_of_birth).getTime()
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update date of birth failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update date of birth is successful"});
                    return;
                }

            });
    },
    /*
     * Function is used to update start day time field (Onboard process)
     *@ start_day_time:- time in 12 hour format.
     * */
    update_start_day_time:function(email,req, res){

        var userObj = {email:email};
        var updateObject ={
            "start_day_time":(req.body.start_day_time).toUpperCase()
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update start day time failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update start day time is successful"});
                    return;
                }

            });
    },

    /**
     * To add/update the diabetes type of a user
     *
     */

    update_diabetes_type: function(email, req, res) {
        var updateObject ={
            diabetes_type: globalConfig.diabetes_types[req.body.diabetes_type]
        };

        async.series([
                function(next){
                    userModel.updateItem({email: email},updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update diabetes type failed",error_message:JSON.stringify(err, null, 2) });
                    return;
                } else {
                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update diabetes type is successful"});
                }

            });
    },
    
    /**
     * To add/update the user's descibe type
     *
     */

    update_describe_type: function(email, req, res) {
        var updateObject ={
            personality_type: globalConfig.describe_options[req.body.personality_type]
        };

        async.series([
                function(next){
                    userModel.updateItem({email: email},updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update user's personality type failed",error_message:JSON.stringify(err, null, 2) });
                    return;
                } else {
                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update user's personality type is successful"});
                }

            });
    },
    
    /*
     * Function is used to update test reminders field (Onboard process)
     * @ test_reminders:- Array of time in 12 hour format.
     */
    update_test_reminders:function(email,req, res){

        var userObj = {email:email};
        var reminderArr =[];
        if(typeof req.body.test_reminders === 'string'){
            reminderArr.push(req.body.test_reminders)
        }else{
            reminderArr =req.body.test_reminders;
        }

        var remiders =  [];
        for(var i in reminderArr){
            remiders.push(reminderArr[i].trim().toUpperCase());
        }

        var updateObject ={
            "test_reminders":remiders
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update test reminders failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update test reminders is successful"});
                    return;
                }

            });
    },

    /*
     * Function is used to update promotional offers and life scan flag details (Onboard process)
     *
     */
    update_reveal_reports_and_offers:function(email,req, res){

        var monthly_reveal_report = req.body.monthly_reveal_report ==="true" ?true:false;
        var promotional_offers_lifescan = req.body.promotional_offers_lifescan ==="true" ?true:false;
        var userObj = {email:email};
        var updateObject ={
            monthly_reveal_report:monthly_reveal_report,
            promotional_offers_lifescan: promotional_offers_lifescan
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update promotional offers and reveal report details failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update promotional offers and reveal report details  is successful"});
                    return;
                }

            });
    },
    
    /*
     * Function used to log out a user
     */
    
    logout: function (req, res) {
      var token = req.body.token || req.query.token || req.headers['x-access-token'];
      crowd.session.destroy(token, function (err) {
        if(err) {
          res.status(globalConfig.response_status.internal_server_error).json({ success: false, error: 'An error occurred while logging out user', error_message: err.type });
        }
        else {
          res.status(globalConfig.response_status.success).json({ success:true, message: "User is successfully logged out"});
        }
      });
    },
    
    /*
     * Function to change user password
     */
    
    change_password: function(request, response) {
      if(!request.body.hasOwnProperty('old_password') || request.body.old_password.trim() ===""){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide old password" });
        return ;
      }
      if(!request.body.hasOwnProperty('new_password') || request.body.new_password.trim() ===""){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide new password" });
        return ;
      } else if(!commonHelper.validatePassword(request.body.new_password)){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Password must contain atleast 1 number and should be of minimum 8 characters and maximum of 16 characters." });
        return ;
      }
      if(request.body.old_password === request.body.new_password) {
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "New password must be different from the current password" });
        return ;
      }
      var email = request.email;
      var oldPassword = request.body.old_password;
      var newPassword = request.body.new_password;
      
      crowd.user.authenticate(email, oldPassword, function(err, res) {
        if(err) {
          if(err.type === "INVALID_USER_AUTHENTICATION") {
            response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Old password does not match" });
            return;
          } else {
           response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Some error occurred. Please try again.", error_message: err.type});
            return;
          }
        } else if(res) {
          crowd.user.changepassword(email, newPassword, function (err) {
            if(err) {
              response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: 'An error occurred while updating password', error_message: err.type });
              return;
            }
            else {
              response.status(globalConfig.response_status.success).json({ success:true, message: "Password is successfully updated" });    
              return;
            }
          });
        }
      });
    },

    /*
     * Function is used to  update starlix medications field (Onboard process)
     * @ starlix_medications:- Array of time in 12 hour format.
     */
    update_starlix_medications:function(email,req, res){

        var userObj = {email:email};
        var medicationArr =[];
        var reqArr = (req.body.starlix_medications).split(',').filter(Boolean);
        for(var i in reqArr){
            medicationArr.push(reqArr[i].trim().toUpperCase());
        }
        var updateObject ={
            "starlix_medications":medicationArr
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update starlix medications failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update starlix medications is successful"});
                    return;
                }

            });
    },

    /*
     * Function is used to update glynase medications field (Onboard process)
     * @ glynase_medications:- Array of time in 12 hour format.
     */
    update_glynase_medications:function(email,req, res){

        var userObj = {email:email};
        var medicationArr =[];
        var reqArr = (req.body.glynase_medications).split(',').filter(Boolean);
        for(var i in reqArr){
            medicationArr.push(reqArr[i].trim().toUpperCase());
        }
        var updateObject ={
            "glynase_medications":medicationArr
        };

        async.series([
                function(next){
                    userModel.updateItem(userObj,updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){

                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update glynase medications failed",error_message:JSON.stringify(err, null, 2) });
                    return;

                } else {

                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update glynase medications is successful"});
                    return;
                }

            });
    },
    
    /*
     * Main handler function for forgot password feature
     * @param mix request
     * @param mix response
     * @returns response
     */
    
    forgot_password: function(request, response) {
      if(!request.body.hasOwnProperty('action_type') || request.body.action_type.trim() === "" || globalConfig.forgot_password_action.indexOf(request.body.action_type) === -1){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide an action type from getRecoveryCode, checkRecoveryCode or setNewPassword" });
        return ;
      } 
      
      switch(request.body.action_type) {
        case 'getRecoveryCode':
          module.exports.sendRecoveryCode(request, response);
          break;
        case 'checkRecoveryCode':
          module.exports.check_password_recoverycode(request, response);
          break;
        case 'setNewPassword':
          module.exports.set_new_password(request, response);
          break;
      }
    },
    
    /*
     * To send password recovery code to the user's email
     * @param mix request
     * @param mix response
     * @returns response
     */
    
    sendRecoveryCode: function(request, response) {
      if(!request.body.hasOwnProperty('email') || request.body.email.trim() ===""){
          response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Email" });
          return ;
      } else if(!commonHelper.validateEmail(request.body.email)){
          response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Proper User Email" });
          return ;
      }
      var email = request.body.email;
      crowd.user.find(email, function(err, res) {
        if(err) {
          response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: 'An error occurred', error_message: err.type });
        }
        else {
          var psw_recovery_code = commonHelper.generateRandomCode();
          var transporter = nodemailer.createTransport(globalConfig.forgot_password_mail_config.SMTP);
          
          globalConfig.forgot_password_mail_config.mailOptions.html += psw_recovery_code;
          globalConfig.forgot_password_mail_config.mailOptions.to = email;
          
          transporter.sendMail(globalConfig.forgot_password_mail_config.mailOptions, function(error, info){
            if(error){
              response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: 'An error occurred while sending mail', error_message: error });
            } else {
              async.series([
                function(next){
                   userModel.updateItem({email: email}, {'psw_recovery_code': psw_recovery_code.toString()}, next);
                }
              ],
 
              function(asyncError, results){
                if(asyncError){
                    response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "An error occurred while storing recovery code to the database" });
                    return;
                } else {
                    response.status(globalConfig.response_status.success).json({ success:true, message: "Please check your email" });
                    return;
                }
              });    
            }
          });
        }
      });
    },
    
    /*
     * Function to recover the password
     * @param mix request
     * @param mix response
     * @returns response
     */
    
    check_password_recoverycode: function(request, response) {
      if(!request.body.hasOwnProperty('email') || request.body.email.trim() ===""){
          response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Email" });
          return ;
      } else if(!commonHelper.validateEmail(request.body.email)){
          response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Proper User Email" });
          return ;
      }
      if(!request.body.hasOwnProperty('psw_recovery_code') || request.body.psw_recovery_code.trim() === ""){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide password recovery code" });
        return ;
      }
      var email = request.body.email;
      var psw_recovery_code = request.body.psw_recovery_code;
      
      async.series([
        function(next){
          userModel.checkRecoveryCode(email, psw_recovery_code, next);
        }
      ],
 
      function(asyncError, results){
        if(asyncError){
          response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "An error occurred while storing recovery code to the database" });
        } else {
          if(results[0].hasOwnProperty("Count") &&  results[0].Count > 0 ){
            response.status(globalConfig.response_status.success).json({ success:true, message: "Password recovery code is correct" }); 
          } else { 
            response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Password recovery code & email does not match" });
          }
        }
      });      
    },
    
    /*
     * Set new password after using forgot password option
     * @param mix request
     * @param mix response
     * @returns response
     */
    
    set_new_password: function(request, response) {
      if(!request.body.hasOwnProperty('email') || request.body.email.trim() === ""){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide User Email" });
        return;
      } else if(!commonHelper.validateEmail(request.body.email)){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Proper User Email" });
        return;
      }
      if(!request.body.hasOwnProperty('new_password') || request.body.new_password.trim() === ""){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide new password" });
        return;
      } else if(!commonHelper.validatePassword(request.body.new_password)){
        response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Password must contain atleast 1 number and should be of minimum 8 characters and maximum of 16 characters." });
        return;
      }
      var email = request.body.email;
      var newPassword = request.body.new_password;
      crowd.user.changepassword(email, newPassword, function (err) {
        if(err) {
          response.status(globalConfig.response_status.internal_server_error).json({ success:false, error: 'An error occurred while setting new password', error_message: err.type });
          return;
        }
        else {
          async.series([
            function(next){
              var removeAttrs = ['psw_recovery_code'];
              userModel.removeUserAttributes(email, removeAttrs, next);
            }
          ],
          function(err, results){
            response.status(globalConfig.response_status.success).json({ success:true, message: "Password is successfully updated" });    
            return;
         });
        }
      });     
    },

    /*
     * Function is used to complete user details
     *
     */
    user_details:function(req, res){

        async.series([
                function(next){
                    userModel.getUserByEmail(req.email,next);
                }
            ],
            function(err, results){

                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Error in fetching user details.",error_message:JSON.stringify(err, null, 2) });
                    return;
                } else {

                    if(results[0].Items.length>0){

                        var userObj = results[0].Items[0];

                        if(userObj.register_date!==undefined && userObj.register_date!==''){
                            userObj.register_date = commonHelper.convertTimestamptoDate(userObj.register_date);
                        }

                        if(userObj.date_of_birth!==undefined && userObj.date_of_birth!==''){
                            userObj.date_of_birth = commonHelper.convertTimestamptoDate(userObj.date_of_birth);
                        }

                        if(userObj.personality_type !==undefined && userObj.personality_type!==''){
                            for(var key in globalConfig.describe_options ){
                                if(globalConfig.describe_options[key] === userObj.personality_type){
                                    userObj.personality_type = key;
                                }
                            }
                        }

                        if(userObj.diabetes_type !==undefined && userObj.diabetes_type!==''){
                            for(var key in globalConfig.diabetes_types ){
                                if(globalConfig.diabetes_types[key] === userObj.diabetes_type){
                                    userObj.diabetes_type = key;
                                }
                            }
                        }

                        if(userObj.country !==undefined && userObj.country!==''){
                            for(var key in globalConfig.countries ){
                                if(globalConfig.countries[key] === userObj.country){
                                    userObj.country = key;
                                }
                            }
                        }

                        if(userObj.glynase_medications !==undefined && userObj.glynase_medications!==''){
                            userObj.glynase_medications = userObj.glynase_medications.toString();
                        }

                        if(userObj.starlix_medications !==undefined && userObj.starlix_medications!==''){
                            userObj.starlix_medications = userObj.starlix_medications.toString();
                        }

                        res.status(globalConfig.response_status.success).json({ success:true, user: userObj});
                        return;

                    }else{
                        res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Cannot find respective user details" });
                        return;
                    }
                }

            });
    },
    
  /**
   * To send the data to the mobile from the server
   * @param {type} request
   * @param {type} response
   * @returns {undefined}
   */

  sync_pull: function(request, response) {

    if(!request.body.hasOwnProperty('user_id') || request.body.user_id.trim() === ""){
      response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user id" });
      return ;
    }

    if(!request.body.hasOwnProperty('device_id') || request.body.device_id.trim() === ""){
      response.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide device id" });
      return ;
    }

    var userId = request.body.user_id;
    var deviceId = request.body.device_id;

    async.series([
      function(next){
          var reqObj = {
            "userId": userId,
            "deviceId": deviceId
          };
          userModel.getLastSyncTime(reqObj, next);
        }
      ],
      function(err, res) {
        response.status(200).json({error: err, success: res});
      });
  },


    /**
     * To push data into server from mobile. Data should be in json format.
     * @param {type} request
     * @param {type} response
     */
    sync_push: function (request, response) {

        // Json object
        var obj = request.body;

        // Details that are to be added must be passed in jdon's add object
        if (obj.add !== null && obj.add !== undefined && obj.add !== "" && Object.keys(obj.add).length !== 0) {

            // Validation to check the table (collections) name passed are valid.
            var tableArr = ["jnj_users", "jnj_user_reminders", "jnj_user_devices", "jnj_user_devices_log", "jnj_device_pairing", "jnj_device_reading", "jnj_event_log"];
            var tables = Object.keys(obj.add);
            tables.forEach(function (key) {
                if (tableArr.indexOf(key) === -1) {
                    response.status(globalConfig.response_status.unprocessable_entity).json({
                        success: false,
                        error: "Invalid table name [" + key + "] , table name can be jnj_users, jnj_user_reminders, jnj_user_devices, jnj_user_devices_log, jnj_device_pairing, jnj_device_reading, jnj_event_log"
                    });
                    return;
                }
            });


            var asyncTasks = []
            tables.forEach(function (key) {

                // to get object based on the key(table names)
                var currentObj = obj.add[key];
                if (currentObj !== null && currentObj !== undefined && currentObj !== "" && Object.keys(currentObj).length !== 0) {

                    // Check to see if passed object is array or not
                    if (Array.isArray(currentObj)) {

                        // if object is array then it is added individually in async task array
                        currentObj.forEach(function (o) {

                            asyncTasks.push(function (callback) {
                                userModel.syncPush(key, o, function (err, result) {
                                    callback(err, result);
                                });
                            });

                        });
                    } else {

                        // if it is not an array then it is directly added in async task array
                        asyncTasks.push(function (callback) {
                            userModel.syncPush(key, currentObj, function (err, result) {
                                callback(err, result);
                            });
                        });

                    }
                }
            });

            // Database call to store objects in async task
            async.parallel(asyncTasks, function (asyncError, asyncResult) {
                if (asyncError) {
                    response.status(globalConfig.response_status.internal_server_error).json({
                        success: false,
                        error: "Error occured while syncing.",
                        error_message: JSON.stringify(asyncError, null, 2)
                    });
                    return;
                } else {
                    response.status(globalConfig.response_status.success).json({
                        success: true,
                        message: "Sync push is successful"
                    });
                    return;
                }
            });

        } else {
            response.status(globalConfig.response_status.unprocessable_entity).json({
                success: false,
                error: "Empty add object. "
            });
            return;
        }

    }

};
