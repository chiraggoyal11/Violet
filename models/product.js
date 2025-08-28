const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    user_id : {
        type : String,
        required : true
    },
    Product_Name : {
        type : String,
        required : true
    },
    Product_Detail : {
        type : String,
        required : true
    },
    Price : {
        type : String,
        required : true
    },
    Image :{
        type : String,
        required : false
    },
    ImageUrl :{
        type : String,
        required : false
    }
});

module.exports= mongoose.model('Product', productSchema);