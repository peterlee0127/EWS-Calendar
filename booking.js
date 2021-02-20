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

    if(httpResponse && httpResponse.statusCode!=200){callback(null);return;}
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
function getReservations(callback, getRecentMonthReservation = false) {
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
    //let endDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+92 ).toISOString();
   //let endDay = new Date("2021-01-31").toISOString(); 
   let endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()+103).toISOString();
// prevent timezone problem.
    if(getRecentMonthReservation==true) {
      previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-120 ).toISOString();
      endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()+120).toISOString();
    }

    let GetReservationsURL = config.reserveUrl+`Reservations/?resourceId=65&startDateTime=${previousDay}&endDateTime=${endDay}`;
    let header = {
      "X-Booked-SessionToken": token,
      "X-Booked-UserId": "505",
      "content-type": "application/json",
      "cache-control": "no-cache"
    }

    request.get({url:GetReservationsURL, headers: header}, function(err,httpResponse,body){
      try{
        let res = JSON.parse(body);
        for(let i=0;i<res.reservations.length;i++) {
            delete res.reservations[i].firstName;
            delete res.reservations[i].lastName;
            delete res.reservations[i].links;
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


function getReservationsWithTaxId(callback) {
  getReservations( reservations=> {
    let reservationArray = [];
    for(let i=0;i<reservations.reservations.length;i++) {
      let item = reservations.reservations[i];
      if(item.description.includes("taxId")) {
        const regexp = /taxId:[0-9]*/gi;
        const matches_array = item.description.match(regexp);
        if(matches_array.length>0) {
          // only take the first taxId.
          let taxId = matches_array[0].split("taxId:")[1];
          const date = item.startDate.split('T')[0];
          reservationArray.push({ 
            'title': item.title,
            'date': date,
            'startDate': item.startDate,
            'endDate': item.endDate,
            'taxId': taxId
          });

        }
  
      }
    }
    callback(reservationArray)
  }, true);
}

function checkUserCanReserveOfNot(skip ,taxId, reserveDay, canReserve) {
  if(skip) {
    canReserve(true);
    return;
  }
  // check user has any reservation with 3 month.
  let reserveDate = reserveDay.split("T")[0]; 
  getReservationsWithTaxId(reservationArray => {
      for(var i=0;i<reservationArray.length;i++) {
        let reserveItem = reservationArray[i];
        let day = Math.abs((new Date(reserveItem.date).getTime()-new Date(reserveDate).getTime())/86400/1000);
        if(day<=90) {
          canReserve(false, `無法預約，90天內已有預約紀錄，上次預約於 date: ${reserveItem.date}, taxId: ${taxId}。\nSorry, You can't reserve in 90 days.`);
          return;
        }
      }
      canReserve(true);
  }) 
}

// // dict.taxId, dict.start
// checkUserCanReserveOfNot(false, '11111111', '2021-05-01T03:00:00+0000', (canReserve, info) =>{
//   console.log(canReserve);
//   console.log(info);
//   // 無法預約，90天內已有預約紀錄
// });


function bookSchedule(dict,callback) {
 
    const name = dict.name != undefined? dict.name : '已預約';
    const username = dict.userName != undefined? dict.userName : '已預約';
    const email = dict.email != undefined? dict.email : 'email';
    const mobile = dict.mobile != undefined? dict.mobile : 'mobile';
    const department = dict.department != undefined? dict.department : 'department';
    const description = dict.description != undefined? dict.description : 'description';

    const taxId = dict.taxId != undefined? dict.taxId : '';
    const skip = taxId == ''? true : false;

    let pubDescription = '';
    if(dict.needTaxId==true) {
      // new version with taxId.
      pubDescription = `taxId:${taxId}`;
    }
    let startTime = new Date(dict.start).toISOString();
    // dict.taxId, dict.start

    //  // 無法預約，90天內已有預約紀錄
    checkUserCanReserveOfNot(skip, taxId, startTime, (canReserve, info) =>{
      if(canReserve==false) {
        callback(info); 
        return;
      }

    getAuthToken(authToken => {

    const data = JSON.stringify({
      "startDateTime": new Date(dict.start).toISOString(),
      "endDateTime": new Date(dict.end).toISOString(),
      "description": pubDescription,
      "resourceId": "65",
      "title": name,
      "userId": "505",
      "customAttributes": [
        {
          "attributeId": "3",
          "attributeValue": username
        },
        {
          "attributeId": "4",
          "attributeValue": email
        },
        {
          "attributeId": "7",
          "attributeValue": mobile
        },
        {
          "attributeId": "6",
          "attributeValue": department
        },
        {
          "attributeId": "5",
          "attributeValue": description
        }
      ]
    });
  

  let header = {
    "x-booked-sessiontoken": authToken,
    "x-booked-userid": "505",
    "content-type": "application/json",
    "cache-control": "no-cache"
  }

  request.post({url:config.reserveUrl+'Reservations/', form:data, headers: header}, function(err, httpResponse, body){
    if(httpResponse.statusCode!=201){callback(null);return;}
    try{
      let json = JSON.parse(body);
      if(json.message=="The reservation was created"){ // reservation successful.

      // build sms push message;
        if(!dict.name){return;}
        let description = "拜會說明";
        if(dict.description!=undefined){
          description = dict.description.slice(0,1800);
        }

        const title = "社創中心週三拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString();
        const content = "社創中心週三拜會:"+dict.name+"\n時間:"+new Date(dict.start).toString()+"\n預約者:"+dict.username+"\nemail:"+dict.email+"\n行動電話:"+dict.mobile+"\n單位:"+dict.department+"\n拜會內容:"+description;

        sendSmsPush(content);

        let receiver = config.mailgunTarget;
        if (dict.email != undefined) {
          receiver.push(dict.email);
        }
        // sendEmail(title, content, receiver);

      }
      console.log(body);
      callback(body);
    }catch(e) {
      callback(e);
    }
  });

  }); // getAuthtoken
     
  }); // checkUserCanReserveOfNot.
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
      from: 'PDIS <hello@pdis.tw>',
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
