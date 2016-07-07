var globalConfig = require('../../config/global'),
AWS = require('aws-sdk');

module.exports = {

	connection: function(req, res) {
		AWS.config.update(globalConfig.Amazon_Endpoint);
        return AWS;
    },
    DocumentClient:function(){
    	AWS.config.update(globalConfig.Amazon_Endpoint);
    	var DocumentClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
    	return DocumentClient;
    }
    
    
};