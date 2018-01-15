const EWS = require('node-ews');
const config = require('./config.js').config;
const ewsConfig = {
  username: config.useraccount,
  password: config.password,
  host: config.host
};
const fs = require('fs');
const ews = new EWS(ewsConfig);

function search(callback)  {
    const ewsFunction = 'UpdateItem';
    const ewsArgs = {
      'attributes': {
        'ConflictResolution': 'AutoResolve',
        'SendMeetingInvitationsOrCancellations':'SendToAllAndSaveCopy'
      },
      'ItemChanges' : {
        'ItemChange':{
         'ItemId':{
            'attributes': {
               'Id': Idxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,
               'ChangeKey': ChangeKeyxxxxxxxxxxxxxxxxxxx
             }
          },
          'Updates':{
              'AppendToItemField': {
                  'FieldURI': {
                    'attributes':{
                      'FieldURI': 'calendar:RequiredAttendees'
                    }
                  },
                  'CalendarItem':{
                    'RequiredAttendees':{
                        'Attendee':{
                          'Mailbox':{
                            'Name':target_name,
                            'EmailAddress':target_email
                          }
                        }
                    }
                  }
              }
          }
        }
      }
    }

    ews.run(ewsFunction, ewsArgs)
      .then(result => {
        const json = JSON.stringify(result);
        console.dir(json,{depth:null});
        return;
      })
      .catch(err => {
        console.log(err.stack);
        callback(null);
      });
}

search(function(result) {
  console.log(result);
});
