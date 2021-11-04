var fs = require('fs');
var readline = require('readline');
const calendarId = require('./config.js').calendarId;
var {google} = require('googleapis');
var googleAuth = require('google-auth-library');


const nowDate = new Date();
const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
const endDate = new Date(nowDate.getFullYear(), nowDate.getMonth()+6, 1 ); // current month+2 1th day.
console.log(`
startDate: ${startDate},
endDate: ${endDate}
`);
// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';


var client_secret;
// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  client_secret = content;
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  authorize(JSON.parse(content), deleteEvents);
  //authorize(JSON.parse(content), addEvents);
});


function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
	if (err) return getAccessToken(oAuth2Client, callback);
	
	oAuth2Client.setCredentials(JSON.parse(token));
	callback(oAuth2Client);
  });
}


function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

var getDaysArray = function(start, end) {
    for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
        arr.push(new Date(dt));
    }
    return arr;
};

let eventCount = 0;
function deleteEvents(auth) {
  var calendar = google.calendar({version: 'v3', auth});
  const deleteStartDate = new Date(new Date().setDate(new Date().getDate() - 90));
  calendar.events.list({
    auth: auth,
    calendarId: calendarId,
    timeMax: endDate.toISOString(),   // event end time
    timeMin: deleteStartDate.toISOString(),
    maxResults: 2500,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.data.items;
    eventCount = events.length;
    if (events.length == 0) {

      console.log('No upcoming events found.');
        authorize(JSON.parse(client_secret), addEvents);
    } else {
      console.log('Find '+events.length+" events");
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var tryCount = 2;
        setTimeout(deleteEvent, 1800*i, auth, event.id, tryCount);
      }
    }
  });
}

function deleteEvent(auth,eventID,tryCount) {
  var calendar = google.calendar({version: 'v3', auth});
  calendar.events.delete({
    auth: auth,
    calendarId: calendarId,
    eventId: eventID
  }, function(err, response) {
    if(err){console.log(err)
        if(tryCount>0){
            tryCount--;
            setTimeout(deleteEvent,2100,auth,eventID,tryCount);
        }
    }else {
        eventCount--;
        console.log(`delete last event ${eventCount}`);
    }
    if(eventCount<=0){
        authorize(JSON.parse(client_secret), addEvents);
    }
  });
}

function readCalendarData(auth,callback) {
   fs.readFile('./data/pri_calendar.json' , "utf8",function(error,json){
      if(error){
        console.log(error);
      }else {
        var obj = JSON.parse(json);
        callback(obj);
    }// else
    }); // fs.readFile
}

function addEvents(auth) {
    readCalendarData(auth,function(obj){
         var items = obj.items;
         var updateTime = obj.updateTime;
         for(var i =0;i<items.length;i++) {
          var item = items[i];
          var Subject = item.Subject;
          var Location = item.Location;
          var start = item.Start;
          var end = item.End;
          var body = item.body;
         if(new Date(end).getTime()>endDate.getTime()){
            return;
         }
         var event = {
            'summary': Subject,
            'location': Location,
            'start': {
                'dateTime': start,
            },
            'end': {
                'dateTime': end,
            },
            'description':body+'\n\nOutlook更新於: '+new Date(updateTime).toString() + "\n行事曆同步於: " + new Date().toString()
        };
        var tryCount = 3;
        setTimeout(addEvent, 2800*i, auth, event, tryCount);
        } // for loop

    });
}


function addEvent(auth, event, tryCount) {
    if(event!=undefined){
      console.log(event.start.dateTime);
    }
    var calendar = google.calendar('v3');
    calendar.events.insert({
        auth: auth,
        calendarId: calendarId,
        resource: event,
    }, function(err, event) {
    if (err) {
        if(tryCount>0) {
            tryCount--;
            console.log('There was an error contacting the Calendar service: ' + err);
            setTimeout(addEvent, 3800, auth, event, tryCount);
            return;
        }
    }        
    if(event.data != undefined){
      console.log('Event created: %s', event.data.htmlLink);
    }
    });
}
