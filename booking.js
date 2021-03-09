const axios = require('axios').default;
const config = require('./config.js');
const reserveDay = config.reserveDay;
const api_key = config.mailgunKey;
const DOMAIN = config.mailgunDomain;
const mailgun = require('mailgun-js')({apiKey: api_key, domain: DOMAIN});
const ews = require('./EWS-Calendar.js');

function checkToken(token, callback) {
  if(token==undefined) {
    callback(false);
    return;
  }
  const url = config.reserveUrl + 'index.php/Users/';
  let header = {
    'X-Booked-SessionToken': token,
    'X-Booked-UserId': '505',
    'content-type': 'application/json',
    'cache-control': 'no-cache'
  }
  axios({
    'method': 'GET',
    'url': url,
    'headers': header,
  })
  .then(function (response) {
    callback(true);
  }).catch( e=> {
    callback(false);
  });
}

let storedAuthToken = undefined;
function getAuthToken(callback) {
  checkToken(storedAuthToken, tokenIsValid => {
    if(tokenIsValid==true) {
      console.log(`reuse token: ${JSON.stringify(storedAuthToken)}`);
      callback(storedAuthToken);
      return;
    }

    const header = {
      'content-type': 'application/json',
      'cache-control': 'no-cache'
    }
    const data = JSON.stringify({
      'username': config.reserveAccount,
      'password': config.reservePassword
    });
    const url = config.reserveUrl+'Authentication/Authenticate';
    axios({
      'method': 'POST',
      'url': url,
      'headers': header,
      'data': data
    })
    .then(function (response) {
      if(response.status!=200) {
        callback(response.data);
        return;
      }
      try{
        let parsedBody = response.data;
        storedAuthToken = parsedBody.sessionToken;
        console.log(`create token: ${JSON.stringify(storedAuthToken)}`);
        callback(storedAuthToken);
      }catch(e){
        console.log(e);
        callback(null);
      }
    }).catch(function (error) {
      console.log(error);
      callback(error);
    }); 
  });

}

let reservationResult = {};
function getReservations(callback, token, getRecentMonthReservation = false) {
    let nowTS = new Date().getTime()/1000;
    let reservationTS = new Date(reservationResult.updateDate).getTime()/1000;
    if(reservationResult!=undefined && reservationTS+2>=nowTS)  {
      callback(reservationResult);
      console.log("use reservation cache");
      return;
    }else {
      console.log("will update reservation cache");
    }
    if(!token){console.log('token not exist');return;}

    let now = new Date();
    let previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-14 ).toISOString();
 
    let endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()+103).toISOString();
    // prevent timezone problem.

    if(getRecentMonthReservation==true) {
      previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-120 ).toISOString();
      endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()+120).toISOString();
    }

    let getReservationsURL = config.reserveUrl+`Reservations/?resourceId=65&startDateTime=${previousDay}&endDateTime=${endDay}`;
    let header = {
      'X-Booked-SessionToken': token,
      'X-Booked-UserId': '505',
      'content-type': 'application/json',
      'cache-control': 'no-cache'
    }

    axios({
      'method': 'GET',
      'url': getReservationsURL,
      'headers': header,
    })
    .then(function (response) {
      try{
        const body = response.data;
        let res = body;
        for(let i=0;i<res.reservations.length;i++) {
            delete res.reservations[i].firstName;
            delete res.reservations[i].lastName;
            delete res.reservations[i].links;
        }
        callback(res);
      } catch(e){
           console.log(e);
           console.log(response);
       }
    }).catch(function (error) {
      console.log(error);
      callback(error);
    }); // 

}


function getReservationsWithTaxId(token, callback) {
  getReservations( reservations=> {
    let reservationArray = [];
    for(let i=0;i<reservations.reservations.length;i++) {
      let item = reservations.reservations[i];
      if(item.description.includes('taxId')) {
        const regexp = /taxId:[0-9]*/gi;
        const matches_array = item.description.match(regexp);
        if(matches_array.length>0) {
          // only take the first taxId.
          let taxId = matches_array[0].split('taxId:')[1];
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
  }, token, true);
}

function checkUserCanReserveOfNot(token, skip ,taxId, reserveDay, canReserve) {
  if(skip) {
    canReserve(true);
    return;
  }
  // check user has any reservation with 3 month.
  let reserveDate = reserveDay.split('T')[0]; 
  getReservationsWithTaxId(token, reservationArray => {
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


function bookSchedule(dict, authToken, callback) {
 
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
    checkUserCanReserveOfNot(authToken, skip, taxId, startTime, (canReserve, info) =>{
      if(canReserve==false) {
        callback(info); 
        return;
      }

    const data = JSON.stringify({
      'startDateTime': new Date(dict.start).toISOString(),
      'endDateTime': new Date(dict.end).toISOString(),
      'description': pubDescription,
      'resourceId': '65',
      'title': name,
      'userId': '505',
      'customAttributes': [
        {
          'attributeId': '3',
          'attributeValue': username
        },
        {
          'attributeId': '4',
          'attributeValue': email
        },
        {
          'attributeId': '7',
          'attributeValue': mobile
        },
        {
          'attributeId': '6',
          'attributeValue': department
        },
        {
          'attributeId': '5',
          'attributeValue': description
        }
      ]
    });
  

  let header = {
    'x-booked-sessiontoken': authToken,
    'x-booked-userid': '505',
    'content-type': 'application/x-www-form-urlencode;charset=utf-8;',
    'cache-control': 'no-cache'
  }

  axios({
    'method': 'POST',
    'url': config.reserveUrl+'Reservations/',
    'headers': header,
    'data': data
  })
  .then(function (response) {
    // handle success
    if(response.status!=201){callback(null);return;}
    reservationResult = undefined;
    try{
      const body = response.data;
      let json = body;
      if(json.message=='The reservation was created'){ // reservation successful.

      // build sms push message;
        if(!dict.name){return;}
        let description = '拜會說明';
        if(dict.description!=undefined){
          description = dict.description.slice(0,1800);
        }

        const title = `社創中心週三拜會: ${dict.name}\n時間: ${new Date(dict.start).toString()}`;
        const content = `社創中心週三拜會: ${dict.name}\n時間: ${new Date(dict.start).toString()}\n預約者: ${dict.username}\nemail: ${dict.email}\n行動電話: ${dict.mobile}\n單位: ${dict.department}\n拜會內容: ${description}`;

        if(dict.name!='Test'){
          sendSmsPush(content);
          sendEmail(content, dict.email);
          syncToCalendar(dict.start, dict.end, `[社創] ${dict.name}`, content);
        }
      }
      callback(body);
    }catch(e) {
      console.log(e);
      callback(e);
    } // try catch end 

  }).catch(function (error) {
    console.log(error);
    callback(error);
  }); // axios success end
   

  }); // checkUserCanReserveOfNot.
}


function sendSmsPush(content) {

  let text = {
    events:[
    {
      type: 'push_request',
      uid: config.smsTarget,
      text: content
    }]
  };

  axios({
    'method': 'POST',
    'url': 'http://127.0.0.1:8081',
    'headers': {'Content-Type':'application/json; charset=utf-8'},
    'data': JSON.stringify(text)
  })
  .then(function (response) {
    console.log('sms push:'+response.data);
  }).catch(function (error) {
    console.log(error);
  }); // axios end
}

function sendEmail(content, target) {
  var data = {
    from: 'PDIS <hello@pdis.tw>',
    to: target,
    cc: config.mailgunTarget,
    subject: '唐鳳拜會預約成功通知',
    text: `
    你好：

    你已預約唐鳳拜會，拜會地點為社會創新實驗中心（仁愛路三段99號），預約資訊如下，如需更改或取消，請直接回覆此信件。本辦保留調整預約的權利。

    ${content}

    *此信箱僅接受拜會相關問題來信，媒體邀約或其餘提問請致電 02-33566577

    `
  };

  mailgun.messages().send(data, function (error, body) {
    console.log(body);
  });
}

function syncToCalendar(startTime, endTime, title, content) {
  ews.writeToCalendar(new Date(startTime).toISOString(), new Date(endTime).toISOString(), title, content);
}



exports.getReservations = getReservations;
exports.getAuthToken = getAuthToken;
exports.bookSchedule = bookSchedule;
