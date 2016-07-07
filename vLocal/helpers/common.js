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
    }
    
};