const jwt = require('jsonwebtoken');

module.exports = async function(req,res,next) {
    const token = req.header('Authorization');
    
    if(!token){
        return res.status(401).json({
            msg : "Authoriztation denied"
        });
    }
    try {
        await jwt.verify(token , process.env.jwtSecret , (err,decoded)=>{
            if(err){
                res.status(401).json({
                    msg:"???"
                });
            }
            else{
                req.user = decoded.user;
                next();
            }
        });
    } catch (error) {
        console.log(error);
    }

}