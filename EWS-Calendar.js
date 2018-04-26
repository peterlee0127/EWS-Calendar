const config = require('./config.js');
const EWS = require('node-ews');

// exchange server connection info
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  host: config.host
};
const ews = new EWS(ewsConfig);

var resultCal = [];

function getCalendarItem(Id,callback)  {
    const ewsFunction = 'GetItem';
    const ewsArgs = {
      'ItemShape': {
        'BaseShape': 'AllProperties',
        // "IncludeMimeContent":"true",
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
//        var jsonObj = JSON.parse(json).ResponseMessages.GetItemResponseMessage.Items.CalendarItem;
  //      console.dir(jsonObj.RequiredAttendees.Attendee,{depth:null});
    //    console.dir(jsonObj.OptionalAttendees.Attendee,{depth:null});
        callback(json);
      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
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

  getCalendarItem(calItemID,function(result) {
    let resultJSON = JSON.parse(result);
    let calendarItem = resultJSON.ResponseMessages.GetItemResponseMessage.Items.CalendarItem;
    var body = '';
    if((calendarItem.Body["$value"])!=null){
      body = calendarItem.Body["$value"];
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
  setTimeout(loadCalendarItem,100,calItemIDs,callback);
}

Date.prototype.getDateStr = function() {
  return this.getFullYear()+' '+(this.getMonth()+1)+'/'+this.getDate();
}
