const jwt = require("jsonwebtoken");

// decode token
module.exports.authenticationMiddleware = function (req, res, next) {
     try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.jwt_secret);

        req.body.userId = decoded.userId;
        next();
     } catch (error) {
        res.send({
           message: error.message,
           success: false,
        });
     }
}

module.exports.authorizationMiddleware = function(req, res, next) {
   if (!req.headers.authorization) {
       return res.status(401).send({
           message: 'No authorization token provided',
           success: false,
       });
   }

   try {
       const token = req.headers.authorization.split(' ')[1];
       if (!token) {
           return res.status(401).send({
               message: 'Malformed authorization header',
               success: false,
           });
       }

       const decoded = jwt.verify(token, process.env.jwt_secret);
       if (decoded.isAdmin) {
           next();
       } else {
           return res.status(403).send({
               message: 'Insufficient privileges',
               success: false,
           });
       }
   } catch (error) {
       return res.status(401).send({
           message: error.message,
           success: false,
       });
   }
};
