var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'dwqj1io32rj828sasadsf3';

function encrypt(text){
      var cipher = crypto.createCipher(algorithm,password)
      var crypted = cipher.update(text,'utf8','hex')
      crypted += cipher.final('hex');
      return crypted;
}

function decrypt(text){
      if(!text){return;}
      var decipher = crypto.createDecipher(algorithm,password)
      var dec = decipher.update(text,'hex','utf8')
      dec += decipher.final('utf8');
      return dec;
  }
exports.decrypt = decrypt;
