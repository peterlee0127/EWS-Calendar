const config = require('./config.js');
const EWS = require('node-ews');
//const NTLMAuth = require('httpntlm').ntlm;
const passwordPlainText = config.password//'mypassword';

// store the ntHashedPassword and lmHashedPassword to reuse later for reconnecting
//const ntHashedPassword = NTLMAuth.create_NT_hashed_password(passwordPlainText);
//const lmHashedPassword = NTLMAuth.create_LM_hashed_password(passwordPlainText);

// exchange server connection info
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  //nt_password: ntHashedPassword,
  //lm_password: lmHashedPassword,
  host: config.host
};
const ews = new EWS(ewsConfig);

var resultCal = [];

function getCalendarItem(Id,callback, retry = 5)  {
    console.log(`try: ${Id}, ${retry}`);
    const ewsFunction = 'GetItem';
    const ewsArgs = {
      'ItemShape': {
        'BaseShape': 'AllProperties',
//        "IncludeMimeContent":"true",
        "BodyType":'Text'
      },
      'ItemIds' : {
         'ItemId':{
            'attributes': {
               'Id': Id
             }
          }
      }
    }

    ews.run(ewsFunction, ewsArgs)
      .then(result => {
        const json = JSON.stringify(result);
	if(retry!=5){
    		console.log(`fix: ${Id}, ${retry}`);
        }
	callback(json);
      })
      .catch(err => {
	 console.log(err);
	 console.log(`error: ${Id}, ${retry}`);
        if(retry>0){
	  retry = retry - 1;
          getCalendarItem(Id, (item=> {
	   callback(item);
	  }), retry);
        }else{
          console.log(err);
          callback(null);
        }
      });
}
exports.getCalendarItem = getCalendarItem;


function fetchCalendar(StartDate,EndDate,callback)  {
    const ewsFunction = 'FindItem';
    const ewsArgs = {
      'attributes': {
        'Traversal': 'Shallow'
      },
      'ItemShape': {
        'BaseShape': 'AllProperties'
      },
      'CalendarView':{
        'attributes':{
          'StartDate':StartDate,
          'EndDate': EndDate
        }
      },
      'ParentFolderIds' : {
        'DistinguishedFolderId': {
          'attributes': { 'Id': 'calendar' },
          'Mailbox':{
            'EmailAddress': config.targetCalendar
          }
        }
      }
    }

    ews.run(ewsFunction, ewsArgs)
      .then(result => {
        const json = JSON.stringify(result);
        const jsonObj = JSON.parse(json);
        const calendar = jsonObj.ResponseMessages.FindItemResponseMessage.RootFolder.Items.CalendarItem;
        var array = [];

        for(var i=0;i<calendar.length;i++){
            const item = calendar[i];
            let calItemID = item['ItemId']['attributes']['Id'];
            array.push(calItemID);
        }
        console.log("calendar count:"+array.length);
        totoalCount = array.length;
        loadCalendarItem(array,callback);

      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
      });
}
exports.fetchCalendar = fetchCalendar;

var totoalCount = 0;
function loadCalendarItem(calItemIDs,callback) {
  if(calItemIDs.length<=0){
    callback(resultCal);
    return
  }
  var calItemID = calItemIDs[0];
  let attendeeInfo = "";
  getCalendarItem(calItemID,function(result) {
    let resultJSON = JSON.parse(result);
    if(result==undefined){return;}
    let calendarItem = resultJSON.ResponseMessages.GetItemResponseMessage.Items.CalendarItem;
    let requiredAttendees = calendarItem.RequiredAttendees;
    let attendees = requiredAttendees;
    if(attendees && attendees.Attendee) {
        attendees = attendees.Attendee;
        if(attendees.length>0){
          attendees = attendees.map(_=> _.Mailbox.Name + "(" + _.Mailbox.EmailAddress + ")");
          attendeeInfo = attendees.join("\n");
        }else {
            let mailBox = attendees.Mailbox;
            attendeeInfo = mailBox.Name + "("+ mailBox.EmailAddress + ")";
        }
    }
    var body = attendeeInfo;
    if((calendarItem.Body["$value"])!=null){
      body = attendeeInfo + "\n\n" + calendarItem.Body["$value"];
    }
    const obj = {
      'Id': calendarItem['ItemId']['attributes']['Id'],
      'Subject': calendarItem['Subject'],
      'Start': calendarItem['Start'],
      'End': calendarItem['End'],
      'Importance': calendarItem['Importance'],
      'Location': calendarItem['Location'],
      'body':body
    };
    resultCal.push(obj);
  });
  calItemIDs.shift();
  console.log("last item: "+calItemIDs.length+"/"+totoalCount);
  setTimeout(loadCalendarItem, 1200,calItemIDs,callback);
}

Date.prototype.getDateStr = function() {
  return this.getFullYear()+' '+(this.getMonth()+1)+'/'+this.getDate();
}


function writeToCalendar(startTime, endTime, title, content) {
  const ewsFunction = 'CreateItem';
  let calendarItem = 	{
  "Subject": title,
  "Body": {
    "attributes": {
      "BodyType": "Text"
    },
    "$value": `${content}\n Synced by EWS Bot.`
  },
  "ReminderMinutesBeforeStart": "60",
  "Start": startTime,
  "End": endTime,
  "Location": "社創中心",
  "RequiredAttendees": {
    "Attendee": [
      // {
      //   "Mailbox": {
      //     "EmailAddress": "",
      //   }
      // }
    ]
  },
  "TimeZoneContext": {
    "TimeZoneDefinition": {
      "attributes": {
        "Id": "Taipei Standard Time"
      }
    }
  }
  };
  let ewsArgs = {
    "attributes" : {
      "SendMeetingInvitations" : "SendToNone"
      // SendOnlyToAll, SendToAllAndSaveCopy, SendToNone
    },
    'SavedItemFolderId' : {
      'DistinguishedFolderId': {
        'attributes': { 'Id': 'calendar' },
        'Mailbox':{
          'EmailAddress': config.targetCalendar
        }
      }
    },
    "Items" : {
        "CalendarItem" : calendarItem
    }
  }
  console.dir(ewsArgs, {depth: null});

  ews.run(ewsFunction, ewsArgs)
  .then(result => {
    const json = JSON.stringify(result);
    const jsonObj = JSON.parse(json);
    console.dir(jsonObj,{depth:null});

  })
  .catch(err => {
    console.log(err.stack);
    callback(null);
  });

}

exports.writeToCalendar = writeToCalendar;
