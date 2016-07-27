var dynamodb = require('../helpers/dynamodb'),
    async = require('async'),
    table_name = "jnj_user_device",
    globalConfig = require('../../config/global');

module.exports = {

    /**
    * Function is been created for storing device of user during detecting
    * @ identifier :- device identifier
    * @ serialNumber :- serial number of device
    * @ deviceName :- name of device
    * @ token:- must be there to retrive email
    * After storing device and their logs it will resturn success message
    */
    registerDevice: function(req,callback) {

        var params = {
             TableName: table_name,
             Item: {
                 "identifier":  req.body.identifier,
                 "serialNumber": req.body.serialNumber,
                 "deviceName": req.body.serialNumber,
                 "user":req.email,
                 "register_date": new Date().getTime()
             }
        };  
        dynamodb.put(params,callback);
    },

    /**
    * Function is been created for storing device of user during detecting
    * @ identifier :- device identifier
    * return device object if device detected
    */

    getDeviceByIdentifier: function(identifier,callback) {

        var params = {
            TableName : table_name,
            KeyConditionExpression: "#device_identifier = :identifier_val",
            ExpressionAttributeNames:{
                "#device_identifier": "identifier"
            },
            ExpressionAttributeValues: {
                ":identifier_val":identifier
            }
        };
        
        dynamodb.query(params,callback);
    },

    /**
     * Function is used to get user devices
     * @ email :- user's email address
     * return user's devices
     */

    getDeviceByUser: function(email,callback) {
        var params = {
            TableName : table_name,
            IndexName: "userIndex",
            ProjectionExpression :  "identifier,serialNumber,deviceName",
            KeyConditionExpression: "#user_email = :email_val",
            ExpressionAttributeNames:{
                "#user_email": "user",
            },
            ExpressionAttributeValues: {
                ":email_val":email,
            },
        };

        dynamodb.query(params,callback);
    }
}
    