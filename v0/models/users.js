var bcrypt = require('bcrypt-nodejs'),
    dynamodb = require('../helpers/dynamodb'),
    async = require('async'),
    table_name = "jnj_user",
    jwt = require('jsonwebtoken'),
    globalConfig = require('../../config/global');

module.exports = {

    generateHash: function(password) {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
    },
    validPassword: function(password,currentpassword) {
        return bcrypt.compareSync(password, currentpassword);
    },
    generatToken:function(userData) {
        
        var token = jwt.sign({email:userData.email}, globalConfig.token.token_private_key, {
          expiresIn: globalConfig.token.expiration_period.expiresIn // expires in 1 hour
        });
        return token;
    },
    updateItem:function(userData,updateObject,callback){

        var UpdateExpression ='set ';
        var ExpressionAttributeValues={};

        Object.keys(updateObject).forEach(function(key,index){
            var keyreference = ':a'+index;
            var strSpace = (index !==0)?',':' ';
            UpdateExpression += strSpace+key +" = "+ keyreference;
            ExpressionAttributeValues[keyreference] = updateObject[key];
        });

        var params = {
            TableName:table_name,
            Key:{
                "email": userData.email,
            },
            UpdateExpression: UpdateExpression,
            ExpressionAttributeValues:ExpressionAttributeValues
        };

        dynamodb.update(params,callback);
    },
    storeToken:function(userData,token,expiretime,callback) {
        var params = {
            TableName:table_name,
            Key:{
                "email": userData.email,
            },
            UpdateExpression: "set sec_token = :r, token_expire_time=:p,lastlogin=:a",
            ExpressionAttributeValues:{
                ":r":token,
                ":p":expiretime,
                ":a":new Date().getTime()
            }
        };
        dynamodb.update(params,callback);
    },
    registerUser: function(req,callback) {

        var hashPass = module.exports.generateHash(req.body.password);

        var monthly_reveal_report=false;
        if(req.body.hasOwnProperty('monthly_reveal_report')){
            monthly_reveal_report = req.body.monthly_reveal_report.trim() ==="true" ?true:false;
        }

        var promotional_offers_lifescan=false;
        if(req.body.hasOwnProperty('promotional_offers_lifescan') ){
            promotional_offers_lifescan = req.body.promotional_offers_lifescan.trim() ==="true" ?true:false;
        }

        var params = {
             TableName: table_name,
             Item: {
                 "email":  req.body.email,
                 "register_type": "native",
                 "register_date": new Date().getTime(),
                 "monthly_reveal_report": monthly_reveal_report,
                 "promotional_offers_lifescan":promotional_offers_lifescan
             }
        };  
        dynamodb.put(params,callback);
    },
    registerFbUser: function(userObj,callback) {

        var params = {
             TableName: table_name,
             Item: {
                 "email":  userObj.email,
                 "password":userObj.password,
                 "fb_content": userObj.fb_content,
                 "register_type": "facebook",
                 "register_date": new Date().getTime(),
                 "monthly_reveal_report": userObj.monthly_reveal_report,
                 "promotional_offers_lifescan":userObj.promotional_offers_lifescan
             }
        };  
        dynamodb.put(params,callback);
    },
    getUserByEmail: function(email,callback) {

        var params = {
            TableName : table_name,
            KeyConditionExpression: "#user_email = :email_val",
            ExpressionAttributeNames:{
                "#user_email": "email"
            },
            ExpressionAttributeValues: {
                ":email_val":email
            }
        };
        
        dynamodb.query(params,callback);
    },
    checkRecoveryCode: function(email, pswRecoveryCode, callback) {

      var params = {
            TableName : table_name,
            ExpressionAttributeNames:{
                "#user_email": "email",
                "#psw_recovery_code": "psw_recovery_code"
            },
            ExpressionAttributeValues: {
                ":email_val":email,
                ":psw_recovery_code": pswRecoveryCode
            },
            FilterExpression: "#psw_recovery_code = :psw_recovery_code",
            KeyConditionExpression: "#user_email = :email_val",            
        };
        
        dynamodb.query(params,callback);
    },
    removeUserAttributes: function(key, removeAttrs, callback) {
        var UpdateExpression ='REMOVE ';

        removeAttrs.forEach(function(key, index){
          if(index !== removeAttrs.length-1) { 
            UpdateExpression += key + ", ";
          } else {
            UpdateExpression += key;
          }          
        });

        var params = {
            TableName: table_name,
            Key:{
                "email": key
            },
            UpdateExpression: UpdateExpression
        };

        dynamodb.update(params,callback);
    },
    
    /**
     * To get the last sync time of a device
     * @param {type} reqObject
     * @param {type} callback
     * @returns {undefined}
     */
    
    getLastSyncTime: function(reqObject, callback) {      
      var params = {
        TableName: "jnj_sync_details",
        IndexName: "user_sid-device_identifier-index",
        KeyConditionExpression: "#user_sid = :user_sid and #device_identifier = :device_identifier",
        ExpressionAttributeNames: {
          "#user_sid": "user_sid",
          "#device_identifier": "device_identifier"
        },
        ExpressionAttributeValues: {
          ":user_sid": Number(reqObject.userId),
          ":device_identifier": reqObject.deviceId
        }
      };
      
      dynamodb.query(params, callback);
    },

    syncPush: function(tableName, object, callback) {
        var params = {
            TableName: tableName,
            Item: object
        };
        dynamodb.put(params,callback);
    }
}
    