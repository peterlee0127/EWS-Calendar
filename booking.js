const request = require('request');
const config = require('./config.js');
const reserveDay = config.reserveDay;

function getAuthToken(callback) {
  let data = JSON.stringify({
    "username": config.reserveAccount,
    "password": config.reservePassword
  });

  let header = {
    "content-type": "application/json",
    "cache-control": "no-cache"
  }
  request.post({url:'https://booked.pdis.rocks/booked_tang/Web/Services/Authentication/Authenticate', form:data, headers: header}, function(err,httpResponse,body){
      let token = JSON.parse(body).sessionToken;
      callback(token);
  });
}

function getReservations(callback) {
  getAuthToken(token => {
    let now = new Date();
    let previousDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-14 ).toISOString();
    let endDay = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+90 ).toISOString();

    let GetReservationsURL = `https://booked.pdis.rocks/booked_tang/Web/Services/Reservations/?resourceId=65&startDateTime=${previousDay}&endDateTime=${endDay}`;
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
            "title": "另有公務行程",
            "userId": "505",
            "customAttributes": [
              {
                "attributeId": "3",
                "attributeValue": "另有公務行程"
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
                "attributeValue": "另有公務行程"
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

      request.post({url:'https://booked.pdis.rocks/booked_tang/Web/Services/Reservations/', form:data, headers: header}, function(err,httpResponse,body){
	let json = JSON.parse(body);
	if(json.message=="The reservation was created"){
	// build line push message;
	let text = {	//stpeng,peter
			events:[
			{
				type:'push_request',
				uid:[	"U3ac082a96709434053e9c787199aabfd",
					"Ufbcea5cc37693f864840c1d3fd90741f"],
				text:dict.name+" 時間"+new Date(dict.start).toISOString()+" 預約者:"++dict.username+" email:"+dict.email+" 單位:"+dict.department
			}]
		   };
				
	const lineMessage = {
		method:'POST',
		url:'http://127.0.0.1:8081',
		'body':JSON.stringify(text),
		'headers': {"Content-Type":"application/json; charset=utf-8"}
	}	        
	request.post(lineMessage,function(error,response,body){
		console.log("line push:"+body);
	});
	}
          console.log(body);
          callback(body);
      	});
}

exports.getReservations = getReservations;
exports.getAuthToken = getAuthToken;
exports.bookSchedule = bookSchedule;
