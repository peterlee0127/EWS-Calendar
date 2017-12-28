const EWS = require('node-ews');
const config = require('./config.js').config;
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  host: config.host
};
const fs = require('fs');
const ews = new EWS(ewsConfig);

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
            const obj = {
              'Subject': item['Subject'],
              'Start': item['Start'],
              'End': item['End'],
              'Importance': item['Importance'],
              'Location': item['Location']
            };
            array.push(obj);
        }
        const now = new Date();
        callback({
            items:array,
            updateTime:now.toISOString()
        });

      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
      });
}

const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), 1 );
const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);
console.log(start.toString()+"-->"+end.toString());

FetchCalendar(start.toISOString(),end.toISOString(),function(calendar){
  if(!calendar){
      return;
  }
  fs.writeFileSync('./calendar.json',JSON.stringify(calendar),'utf8');
  console.log("ok");
})
