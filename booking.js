const request = require('request');
const config = require('./config.js');
const reserveDay = config.reserveDay;
const api_key = config.mailgunKey;
const DOMAIN = config.mailgunDomain;
const mailgun = require('mailgun-js')({apiKey: api_key, domain: DOMAIN});

function getAuthToken(callback) {
  let data = JSON.stringify({
    "username": config.reserveAccount,
    "password": config.reservePassword
  });

  let header = {
    "content-type": "application/json",
    "cache-control": "no-cache"
  }
  request.post({url:config.reserveUrl+'Authentication/Authenticate', form:data, headers: header}, function(err,httpResponse,body){
    let token = JSON.parse(body).sessionToken;
    callback(token);
  });
}

function getReservations(callback) {
  getAuthToken(token => {
    let now = new Date();
    let previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-14 ).toISOString();
    let endDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+90 ).toISOString();

    let GetReservationsURL = config.reserveUrl+`Reservations/?resourceId=65&startDateTime=${previousDay}&endDateTime=${endDay}`;
    let header = {
      "X-Booked-SessionToken":token,
      "X-Booked-UserId": "505",
      "content-type": "application/json",
      "cache-control": "no-cache"
    }


    request.get({url:GetReservationsURL, headers: header}, function(err,httpResponse,body){
        //callback(body);
        let res = JSON.parse(body);
        for(let i=0;i<res.reservations.length;i++) {
          delete res.reservations[i].firstName;
          delete res.reservations[i].lastName;
        }
        callback(res);

    });
  });
}



function bookSchedule(dict,authToken,callback) {
  var data = JSON.stringify({
            "startDateTime": new Date(dict.start).toISOString(),
            "endDateTime": new Date(dict.end).toISOString(),
            "description": "des",
            "resourceId": "65",
            "title": "已預約",
            "userId": "505",
            "customAttributes": [
              {
                "attributeId": "3",
                "attributeValue": "已預約"
              },
              {
                "attributeId": "4",
                "attributeValue": "可聯繫的email"
              },
              {
                "attributeId": "6",
                "attributeValue": "單位名稱"
              },
              {
                "attributeId": "5",
                "attributeValue": "已預約"
              }
            ]
          });

  if(dict.username!=undefined) {
    data = JSON.stringify({
          "startDateTime": new Date(dict.start).toISOString(),
          "endDateTime": new Date(dict.end).toISOString(),
          "description": "des",
          "resourceId": "65",
          "title": dict.name,
          "userId": "505",
          "customAttributes": [
            {
              "attributeId": "3",
              "attributeValue": dict.username
            },
            {
              "attributeId": "4",
              "attributeValue": dict.email
            },
            {
              "attributeId": "6",
              "attributeValue": dict.department
            },
            {
              "attributeId": "5",
              "attributeValue": dict.description
            }
          ]
        });
  }


  let header = {
    "x-booked-sessiontoken":authToken,
    "x-booked-userid": "505",
    "content-type": "application/json",
    "cache-control": "no-cache"
  }

  request.post({url:config.reserveUrl+'Reservations/', form:data, headers: header}, function(err,httpResponse,body){
    let json = JSON.parse(body);
    if(json.message=="The reservation was created"){
    // build sms push message;
    if(!dict.name){return;}
    let description = "拜會說明";
    if(dict.description!=undefined){
      description = dict.description.slice(0,1800);
    }

    let title = "社創中心週三下午拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString();
    let content = "社創中心週三下午拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString()+"\n預約者:"+dict.username+"\nemail:"+dict.email+"\n單位:"+dict.department+"\n拜會內容:"+description;

    sendSmsPush(content);
    sendEmail(title,content);

    }
    console.log(body);
    callback(body);
  });
}

function sendSmsPush(content) {

  let text = {
    events:[
    {
      type:'push_request',
      uid:config.smsTarget,
      text:content
    }]
  };

  const smsMessage = {
    method:'POST',
    url:'http://127.0.0.1:8081',
    'body':JSON.stringify(text),
    'headers': {"Content-Type":"application/json; charset=utf-8"}
  }
  request.post(smsMessage,function(error,response,body){
    console.log("sms push:"+body);
  });

}

function sendEmail(subject,text) {
  let target = config.mailgunTarget;
  for(var i=0;i<target.length;i++){
    var data = {
      from: 'PDIS <pdis@pdis.tw>',
      to: target[i],
      subject: subject,
      text: text
    };

    mailgun.messages().send(data, function (error, body) {
      console.log(body);
    });
 }//loop

}


exports.getReservations = getReservations;
exports.getAuthToken = getAuthToken;
exports.bookSchedule = bookSchedule;
