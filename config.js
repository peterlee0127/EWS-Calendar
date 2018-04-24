const key = require('./key.js');
const fs = require('fs');

/*
## config.json sample
{
  "useraccount": "",
  "password": "",
  "host": "",
  "targetCalendar": "",
  "calendarId": ""
}

*/

var config = JSON.parse(fs.readFileSync("./config.json","utf8"));
config.password = key.decrypt(config.password);

module.exports =  config;
