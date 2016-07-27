module.exports = {

    /**
    *  General function to validate email format
    *  @email: given email address to validate    
    */
	validateEmail: function(email) {

		var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
         
    },

    /**
     *  General function to validate date format . Format is yyyy-MM-dd
     *  @dateString: date to validate
     */
    validateDate:function(dateString){
        var regEx = /^\d{4}-\d{2}-\d{2}$/;
        if(!dateString.match(regEx))
            return false;  // Invalid format
        var d;
        if(!((d = new Date(dateString))|0))
            return false; // Invalid date (or this could be epoch)
        return d.toISOString().slice(0,10) == dateString;
    },

    /**
     *  General function to validate time format
     *  @time: time to validate
     */
    validateTime:function(time){
        var re = /^(1[012]|[1-9]):[0-5][0-9]\s?(am|pm)$/i;
        return re.test(time);
    },

    /**
     *  General function to validate password
     *  @time: password must contain atleat 1 numeric  and 8 to 16 digits long.
     */
    validatePassword:function(password){
        var re = /^(?=.*[a-zA-Z])(?=.*\d).{8,16}$/;
        return re.test(password);
    },

    /*
    *   Function to validate future date
    * */
    validateFutureDate:function(dateString){
        var currentDate = new Date();
        var date = new Date(dateString);
        return currentDate>date;
    },
    /*
     *   Convert timestamp into yyyy-MM-dd format
     * */
    convertTimestamptoDate:function(timestamp){
        try{
            var d = new Date(timestamp);
            var day =  d.getDate() <10 ? "0"+d.getDate():d.getDate();
            var month =  (d.getMonth()+1) <10 ? "0"+(d.getMonth()+1):(d.getMonth()+1);
            var date = d.getFullYear()+"-"+month+"-"+day;
            return date;
        }catch (err){
            return "";
        }
    },
    
    /**
     * Genarate a random verification code for forgot pasword feature
     */
    generateRandomCode: function() {
      return Math.floor(Math.random() * ((999999-111111)+1) + 111111);
    }

    
};