const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username : {
        type : String,
        required : true
    },
    avatar : {
        type : String
    },
    phone_no : {
        type : String,
        required : true
    },
    password : {
        type : String,
        required : true
    }
});

module.exports= mongoose.model('User', userSchema);