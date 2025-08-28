const mongoose=require('mongoose');

const connectDB= async() => {
    const conn=await mongoose.connect(process.env.MONGO);

    console.log(`MongoDB connected ${conn.connection.host}`.cyan.bold)
}
module.exports=connectDB;