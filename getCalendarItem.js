const EWS = require('node-ews');
const config = require('./config.js').config;
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  host: config.host
};
const fs = require('fs');
const ews = new EWS(ewsConfig);

function getCalendarItem(Id,callback)  {
    const ewsFunction = 'GetItem';
    const ewsArgs = {
      'ItemShape': {
        'BaseShape': 'AllProperties'
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
        var jsonObj = JSON.parse(json).ResponseMessages.GetItemResponseMessage.Items.CalendarItem;
        console.dir(jsonObj.RequiredAttendees.Attendee,{depth:null});
        console.dir(jsonObj.OptionalAttendees.Attendee,{depth:null});
        callback();
      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
      });
}
const id = searchId;

search(id,function(result) {
  console.log(result);
});
