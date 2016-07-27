var dynamodb = require('../helpers/dynamodb'),
    async = require('async'),
    table_name = "jnj_user_device_logs",
    globalConfig = require('../../config/global');

module.exports = {

    /**
    * Function is been created for storing device logs
    * @ identifier :- device identifier
    * @ logType:- which type of log is been register
    * @ user:- user email address
    */

    registerLogs: function(req,callback) {

        var params = {
             TableName: table_name,
             Item: {
                 "logid": new Date().getTime(),
                 "identifier":  req.body.identifier,
                 "user":req.email,
                 "logType":req.body.logType,
                 "register_date": new Date().getTime()
             }
        };  
        dynamodb.put(params,callback);
    }
}
    