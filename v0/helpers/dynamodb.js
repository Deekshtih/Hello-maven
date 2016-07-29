var amazon = require('../helpers/amazon'),
	async = require('async');

var awsObj = amazon.connection();
    
var dynamodbObj = new awsObj.DynamoDB();
var docClient = new amazon.DocumentClient();

module.exports = {

	scan: function(params,callback) {

		docClient.scan(params, function(err, data) {
			
			callback(null,data.Items);
		  return data.Items;
		});
         
    },
    put:function(params,callback){
    	docClient.put(params, function(err, data) {
	       if (err) {
	           console.error("Unable to add user", ". Error JSON:", JSON.stringify(err, null, 2));
	           //return JSON.stringify(err, null, 2);
	           callback(err);
	       } else {
	           console.log("user register successfully succeeded:");
	           callback(null,data);
	       }
	    });
    },
    get:function(params,callback){
    	docClient.get(params, function(err, data) {
    	    if (err) {
    	        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
    	        callback(err);
    	    } else {
    	        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
    	        console.log(data);
    	        callback(null,data);
    	    }
    	});
    },
    query:function(params,callback){
    	docClient.query(params, function(err, data) {
    	    if (err) {
    	        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
    	        callback(err);
    	    } else {
    	        //console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
    	        callback(null,data);
    	    }
    	});
    },
    update:function(params,callback){
        docClient.update(params, function(err, data) {
            if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                callback(err);
            } else {
                //console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
                callback(null,data);
            }
        });
    }
    
};