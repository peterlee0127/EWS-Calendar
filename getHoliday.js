//http://data.ntpc.gov.tw/api/v1/rest/datastore/382000000A-000077-002
const url = 'http://data.ntpc.gov.tw/api/v1/rest/datastore/382000000A-000077-002';
const request = require('request');
const fs = require('fs');
function getHoliday() {
  request(url, function (error, response, body) {
    if(error == null){
        fs.writeFileSync('./data/holiday.json',JSON.stringify(JSON.parse(body).result.records),'utf8');
        console.log('get holiday ok');
    }
  });
}

getHoliday();
