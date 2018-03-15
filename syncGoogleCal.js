var fs = require('fs');
var readline = require('readline');
const calendarId = require('./config.js').calendarId;
var google = require('googleapis');
var googleAuth = require('google-auth-library');


const nowDate = new Date();
const startDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1 ); // current month 1th day.
const endDate = new Date(nowDate.getFullYear(), nowDate.getMonth()+3, 1 ); // current month+2 1th day.
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

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
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
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}


var eventCount = 0;
function deleteEvents(auth) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: calendarId,
    timeMax: endDate.toISOString(),   // event start time
    timeMin: new Date(nowDate.getFullYear(), 1, 1 ).toISOString(),   // event end time
    maxResults: 2500,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    eventCount = events.length;
    if (events.length == 0) {

      console.log('No upcoming events found.');
        authorize(JSON.parse(client_secret), addEvents);
    } else {
      console.log('Find '+events.length+" events");
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        setTimeout(deleteEvent,300*i, auth, event.id);
      }
    }
  });
}

function deleteEvent(auth,eventID) {
    var calendar = google.calendar('v3');
  calendar.events.delete({
    auth: auth,
    calendarId: calendarId,
    eventId: eventID
  }, function(err, response) {
    if(err){console.log(err)
        setTimeout(deleteEvent,300,auth,eventID);
    }else {
        eventCount--;
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
            'description':body+'此事件同步於 '+new Date(updateTime).toString()
        };

        setTimeout(addEvent,500*i, auth, event);
        } // for loop

    });
}


function addEvent(auth, event, callback) {
    var calendar = google.calendar('v3');
    calendar.events.insert({
        auth: auth,
        calendarId: calendarId,
        resource: event,
    }, function(err, event) {
    if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        setTimeout(addEvent, 600, auth, event);
        return;
    }

        console.log('Event created: %s', event.htmlLink);
    });
}
