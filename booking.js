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
    if(httpResponse.statusCode!=200){callback(null);return;}
    try{
        let token = JSON.parse(body).sessionToken;
        callback(token);
    }catch(e){
        console.log(e);
        callback(null);
    }
  });
}


let reservationResult = {};
function getReservations(callback) {
  let nowTS = new Date().getTime()/1000;
  let reservationTS = new Date(reservationResult.updateDate).getTime()/1000;
  if(reservationResult!=undefined && reservationTS+5>=nowTS)  {
    callback(reservationResult);
    console.log("use reservation cache");
    return;
  }else {
    console.log("will update reservation cache");
  }
  getAuthToken(token => {
    if(!token){console.log('token not exist');return;}

    let now = new Date();
    let previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-14 ).toISOString();
    let endDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+92 ).toISOString();
    // prevent timezone problem.

    let GetReservationsURL = config.reserveUrl+`Reservations/?resourceId=65&startDateTime=${previousDay}&endDateTime=${endDay}`;
    let header = {
      "X-Booked-SessionToken":token,
      "X-Booked-UserId": "505",
      "content-type": "application/json",
      "cache-control": "no-cache"
    }

    console.log(GetReservationsURL);
    request.get({url:GetReservationsURL, headers: header}, function(err,httpResponse,body){
    try{
      let res = JSON.parse(body);
      for(let i=0;i<res.reservations.length;i++) {
          delete res.reservations[i].firstName;
          delete res.reservations[i].lastName;
      }
      reservationResult = res;
      reservationResult.updateDate = new Date().toISOString();
      console.log("update reservation cache");
      callback(res);
	  } catch(e){
		  console.log(e+" "+body);
	  }
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
              "attributeId": "7",
              "attributeValue": dict.mobile
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
    if(httpResponse.statusCode!=201){callback(null);return;}
    try{
      let json = JSON.parse(body);
      if(json.message=="The reservation was created"){
      // build sms push message;
      if(!dict.name){return;}
      let description = "拜會說明";
      if(dict.description!=undefined){
        description = dict.description.slice(0,1800);
      }

      let title = "社創中心週三下午拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString();
      let content = "社創中心週三下午拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString()+"\n預約者:"+dict.username+"\nemail:"+dict.email+"\n行動電話:"+dict.mobile+"\n單位:"+dict.department+"\n拜會內容:"+description;

      sendSmsPush(content);
      let receiver = config.mailgunTarget;
      if (dict.email != undefined) {
        receiver.push(dict.email);
      }
      sendEmail(title,content,receiver);
      receiver.length = 0;

      }
      console.log(body);
      callback(body);
    }catch(e) {
      callback(null);
    }
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

function sendEmail(subject,text,target) {
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
