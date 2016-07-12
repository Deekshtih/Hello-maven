var userModel = require('../models/users'),
    globalConfig = require('../../config/global'),
    async = require('async'),
    jwt = require('jsonwebtoken'),
    commonHelper = require('../helpers/common'),
    authy = require('authy')(globalConfig.authy_key);    

module.exports = {

    /**
    * Function is been created for authenticating user for native login
    * @ email :- email address of user
    * @ password :- password of user
    * After Authenticating it will generate token
    */
    
    native_login: function(req, res) {

        async.series([
            function(next){
                // do some stuff ...
                userModel.getUserByEmail(req.body.email,next);
            }
        ],
        // optional callback
        function(err, results){

            if(err){
                res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "User is not Authenticated, error while fetching data",error_message:JSON.stringify(err, null, 2) });
                return;
            }
            
            if(!results[0].hasOwnProperty("Count") || results[0].Count <= 0 ){
                /* Not Authenticatd */
                res.status(globalConfig.response_status.unauthorized).json({ success:false, error: "User is not Authenticated" });
                return ;
            }
            
            /* Authenticated */
            if(results[0].Items[0].email !== req.body.email){
                res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "User is not Authenticated" });
                return ;
            }    

            if(!userModel.validPassword(req.body.password,results[0].Items[0].password)){
                /* Password does not match*/
                res.status(globalConfig.response_status.unauthorized).json({ success:false, error: "User is not Authenticated" });
                return ;
            } else {

                /* Generating Token */
                module.exports.generateStoreToken(results[0].Items[0],function(token){
                    res.status(globalConfig.response_status.success).json({ success:true, message: "User is Authenticated",token:token });    
                    return ;
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
    native_registration: function(req, res){
        /* validate if email address is already exits */

        async.series([
            function(next){
                // do some stuff ...
                userModel.getUserByEmail(req.body.email,next);
            }
        ],
        // optional callback
        function(err, results){

            if(err){
                res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(err, null, 2) });
                return ;
            } 

            if(results[0].hasOwnProperty("Count") &&  results[0].Count > 0 ){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Email already exists" });
                return ;
            } 
            /**
                Call For registering user in DB
            */
            async.series([
                function(next){
                    userModel.registerUser(req,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "registration fail",error_message:JSON.stringify(err, null, 2) });
                    console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                    return ;
                } 

                module.exports.generateStoreToken({'email':req.body.email},function(token){
                    res.status(globalConfig.response_status.created).json({ success:true, message: "User Added Successfully",token:token });    
                    return ;
                });

            });
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
          var userObj = {email:req.decoded.email};
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
        var onboardTypeArr = ["date_of_birth", "start_day_time", "diabetes_type", "describe_type", "test_reminders","reveal_reports_and_offers"];

        if(!req.body.hasOwnProperty('onboard_type') || req.body.onboard_type.trim() ===""){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide Onboard Type" });
            return ;
        } else if(onboardTypeArr.indexOf(req.body.onboard_type) === -1){
            res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Onboard type should be date_of_birth, start_day_time, diabetes_type, describe_type, test_reminders or reveal_reports_and_offers" });
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
        } else if(req.body.onboard_type === "describe_type" ) {
            /* user describe options type field is compulsory for describe_type onboard type */
            if(!req.body.hasOwnProperty('describe_type') || req.body.describe_type.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please Provide user's describe_type" });
                return ;
            } else if(!globalConfig.describe_options.hasOwnProperty(req.body.describe_type)) {
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide an option for a user's describe type i.e send 'opt1' or 'opt2' or 'opt3'" });
                return ;
            }
        } else if(req.body.onboard_type === "test_reminders" ) {

            /* test_reminders field is compulsory for diabetes_type test_reminders  */
            if(!req.body.hasOwnProperty('test_reminders') || req.body.test_reminders.trim() ===""){
                res.status(globalConfig.response_status.unprocessable_entity).json({ success:false, error: "Please provide user's test reminders" });
                return ;
            }else{
                var reminderArr =[];
                reminderArr =(req.body.test_reminders).split(',').filter(Boolean);
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
        }
        
        switch(req.body.onboard_type)
        {
            case 'date_of_birth':
                module.exports.update_dateofbirth(req.decoded.email,req, res);
                break;
            case 'start_day_time':
                module.exports.update_start_day_time(req.decoded.email,req, res);
                break;
            case 'diabetes_type':
                module.exports.update_diabetes_type(req.decoded.email,req, res);
                break;
            case 'describe_type':
                module.exports.update_describe_type(req.decoded.email,req, res);
                break;
            case 'test_reminders':
                module.exports.update_test_reminders(req.decoded.email,req, res);
                break;
            case 'reveal_reports_and_offers':
                module.exports.update_reveal_reports_and_offers(req.decoded.email,req, res);
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
            describe_type: globalConfig.describe_options[req.body.describe_type]
        };

        async.series([
                function(next){
                    userModel.updateItem({email: email},updateObject,next);
                }
            ],
            // optional callback
            function(err, results){
                if(err){
                    res.status(globalConfig.response_status.internal_server_error).json({ success:false, error: "Onboard process to update user's describe type failed",error_message:JSON.stringify(err, null, 2) });
                    return;
                } else {
                    res.status(globalConfig.response_status.success).json({ success:true, message: "Onboard process to update user's describe type is successful"});
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
        var reqArr = (req.body.test_reminders).split(',').filter(Boolean);
        for(var i in reqArr){
            reminderArr.push(reqArr[i].trim().toUpperCase());
        }
        var updateObject ={
            "test_reminders":reminderArr
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
    }
    
};
