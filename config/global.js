module.exports = {
    'Amazon_Endpoint': {
	  accessKeyId: "AKIAI6M5BU76XDOIAA4Q",
	  secretAccessKey: "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",
	  region: "us-east-1",
	  endpoint: "https://dynamodb.us-east-1.amazonaws.com"
	},
	'countries': {
		'US' : '1',
                'CA' : '1',
		'IN' : '91'
	},
    'token':{
    	'token_private_key':"MIIEpQIBAAKCAQEA3Tz2mr7SZiAMfQyuvBjM9Oi",
    	'expiration_period':{
    		"expiresIn": "1h",
    		"milliseconds":(1 * 3600 * 1000)

    	}
    },
    'response_status':{
    	'success':200,
    	'created':201,
    	'unauthorized':401,
    	'forbidden':403,
    	'bad_request':400,
    	'not_found':404,
    	'unsupported_media_type':415,
    	'unprocessable_entity':422,
    	'internal_server_error':500,
    	
    },
    'describe_options': {
      'opt1' : 'I am managing my diabetes well and am happy to just get on with my life.',
      'opt2' : 'My diabetes is under control and I regularly look for new ways to improve my care.',
      'opt3' : 'Most of the time it\'s hard to manage my diabetes, I could use more help.'  
    },
    'diabetes_types': {
      'opt1' : 'Type1',
      'opt2' :'Type2',
      'opt3' : 'Gestational'
    },
    'authy_key' : '0Gy22nkXEETF91ctZklHoEbZhUzVFeun'
};