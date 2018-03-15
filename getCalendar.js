const EWS = require('node-ews');
const config = require('./config.js').config;
const getCalItem = require('./getCalendarItem.js');
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  host: config.host
};
const fs = require('fs');
const ews = new EWS(ewsConfig);

var resultCal = [];

function FetchCalendar(StartDate,EndDate,callback)  {
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
        console.log(array.length);
        loadCalendarDetail(array,callback);

      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
      });
}

const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-2  );
const end = new Date(now.getFullYear(), now.getMonth()+6 , 1);
console.log(start.toString()+"-->"+end.toString());


function loadCalendarDetail(calItemIDs,callback) {
  if(calItemIDs.length<=0){
    callback(resultCal);
    return
  }
  var calItemID = calItemIDs[0];

  getCalItem.getCalendarItem(calItemID,function(result) {
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
  console.log("left"+calItemIDs.length);
  setTimeout(loadCalendarDetail,500,calItemIDs,callback);
}

function processPublicCalendar(json,callback) {
  var array = [];
  const items = JSON.parse(json);
    for(var i=0;i<items.length;i++){
      const item = items[i];
      const day = new Date(item['Start']).getDay();
      if(day==3){
        var dict = {
          'Subject': item.Subject,
          start: item.Start,
          end: item.End,
          holiday: false
        };
        if(item.Subject=='[au] 空總 Office Hour'){
          array.push(dict);
        }
      }
    }
    fs.readFile( './data/holiday.json', "utf8",function(error,holidays){
        if(error){
          console.log(error);
        }else {
          let holidayArray = JSON.parse(holidays);
          holidayArray = holidayArray.filter(item => item.date.split('/')[0] ==now.getFullYear() && item.isHoliday == '是')
          // only parse this year's holiday.
          for(var j=0;j<array.length;j++){
            const dict = array[j];
            for(var i=0;i<holidayArray.length;i++){
              const holiday = holidayArray[i];
              const holi = holiday.date.split('/');
              const holidayDate = new Date(holi[1]+'/'+holi[2]+' '+holi[0]);
              if(new Date(dict.start).getDateStr()==holidayDate.getDateStr()){
                array[j].holiday = true;
              }
            }
          }
        }// else
        var jsonResult = {
          'items':array,
          'updateTime':new Date().toISOString()
        };
        fs.writeFileSync('./data/pub_calendar.json',JSON.stringify(jsonResult),'utf8');
    });
}

Date.prototype.getDateStr = function() {
  return this.getFullYear()+' '+(this.getMonth()+1)+'/'+this.getDate();
}

FetchCalendar(start.toISOString(),end.toISOString(),function(calendar){
  if(!calendar){
      return;
  }
  processPublicCalendar(JSON.stringify(calendar));

  var jsonResult = {
    'items':calendar,
    'updateTime':new Date().toISOString()
  };
  fs.writeFileSync('./data/pri_calendar.json',JSON.stringify(jsonResult),'utf8');
})
