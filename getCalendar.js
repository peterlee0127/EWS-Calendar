const config = require('./config.js');
const ewsCalendar = require('./EWS-Calendar.js');
const booking = require('./booking.js');
const fs = require('fs');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const reserveDay = config.reserveDay;
const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-2  );
const end = new Date(now.getFullYear(), now.getMonth() ,  now.getDate()+reserveDay*2);
console.log(start.toString()+"-->"+end.toString());



ewsCalendar.fetchCalendar(start.toISOString(),end.toISOString(),function(calendar){
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

function getTimeSlot(dict) {
    // if(dict.holiday) {return;}
    let startT = new Date(dict.start);
    let available = false;
    let next = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+reserveDay)
    if(new Date(startT).getTime()<=next.getTime()) {
      // recent 14 day can reserve.
      available = true;
    }
    let endT = new Date(dict.end);
    let times = endT.getTime()/1000-startT.getTime()/1000;
    let numOfSlot = times/(60*60);  // 60min per slot
    let slot = [];
    for(let j=0;j<numOfSlot;j++){
        let temp = new Date(startT);
        let nstartT = temp.setMinutes(temp.getMinutes() + (60*j));
        let stemp = new Date(nstartT);
        let tend = stemp.setMinutes(new Date(nstartT).getMinutes() + 40);
        slot.push({
            "start": new Date(nstartT),
            "end": new Date(tend),
            "available": available
        });
  }
  return slot;
}

function getWednesday() {
  const startD = new Date(now.getFullYear(), now.getMonth(),  now.getDate()  );
  const endD = new Date(now.getFullYear(), now.getMonth() ,  now.getDate()+60);  // 2 month

  let start = moment(startD);
  let end = moment(endD);

  var arr = [];
  let tmp = start.clone().day(3);
  if( tmp.isAfter(start, 'd') ){
    arr.push(
      {
        'exist': false,
        'time':tmp.format('YYYY-MM-DD')
      });
  }
  while( tmp.isBefore(end) ){
    tmp.add(7, 'days');
    arr.push(
      {
        'exist': false,
        'time':tmp.format('YYYY-MM-DD')
      });
  }
  return arr;
}

function filter(bookingHourArray,authToken) {
  let wednesdays = getWednesday();
  for(let i=0;i<wednesdays.length;i++){
      for(let j=0;j<bookingHourArray.length;j++) {
        let slot = bookingHourArray[j].slots[0].start;
        if(new Date(slot).getDateStr()==new Date(wednesdays[i].time).getDateStr())  {
          wednesdays[i].exist = true;
        }
      }
  }

  for(let i=0;i<wednesdays.length;i++){
    if(wednesdays[i].exist==false){
        let time = new Date(wednesdays[i].time);
        let dict = {
            start: time.setHours("14"),
            end: time.setHours("17")
        };
        let slots = getTimeSlot(dict);
        for(let k=0;k<slots.length;k++) {
            let slot = slots[k];
            setTimeout(booking.bookSchedule, k*30,slot,authToken,function(){});
        }
    }
  }
}

function processPublicCalendar(json,callback) {
  let officeHourArray = [];
  let bookingHourArray = [];
  let otherEvent = [];
  const items = JSON.parse(json);
    for(var i=0;i<items.length;i++){
      const item = items[i];
      const day = new Date(item['Start']).getDay();
      if(day==3){
        let dict = {
          'Subject': item.Subject,
          start: item.Start,
          end: item.End,
          holiday: false
        };
        if(item.Subject == '[au] 空總 Office Hour'){
          officeHourArray.push(dict);
        }
        else if(item.Subject == '[au] 空總 Office Hour-booking'){
            bookingHourArray.push(dict);
        }else {
            otherEvent.push(dict);
        } // else other event
      } // day 3
    }

    fs.readFile( './data/holiday.json', "utf8",function(error,holidays){
        if(error){
          console.log(error);
        }else {
          let holidayArray = JSON.parse(holidays);
          holidayArray = holidayArray.filter(item => item.date.split('/')[0] ==now.getFullYear() && item.isHoliday == '是')
          // only parse this year's holiday.
          for(var j=0;j<officeHourArray.length;j++){
            const dict = officeHourArray[j];
            for(var i=0;i<holidayArray.length;i++){
              const holiday = holidayArray[i];
              const holi = holiday.date.split('/');
              const holidayDate = new Date(holi[1]+'/'+holi[2]+' '+holi[0]);
              if(new Date(dict.start).getDateStr()==holidayDate.getDateStr()){
                officeHourArray[j].holiday = true;
              }
            }
          }



          let slotArray = [];
          for(var i=0;i<bookingHourArray.length;i++) {
              let item = bookingHourArray[i];
              slotArray.push({
                "name": item.Subject,
                "slots": getTimeSlot(item)
              });
          }

          for(var j=0;j<slotArray.length;j++){
            const dict = slotArray[j].slots[0];
            for(var i=0;i<holidayArray.length;i++){
              const holiday = holidayArray[i];
              const holi = holiday.date.split('/');
              const holidayDate = new Date(holi[1]+'/'+holi[2]+' '+holi[0]);
              if(new Date(dict.start).getDateStr()==holidayDate.getDateStr()){
                slotArray[j].holiday = true;
              }
            }
          }

          booking.getAuthToken(function(authToken){

          for(var i=0;i<otherEvent.length;i++){
            let event = otherEvent[i];
            let startT = new Date(event.start);
            let endT = new Date(event.end);
            for(var j=0;j<slotArray.length;j++) {
              let slots = slotArray[j].slots;
              for(var k=0;k<slots.length;k++) {
                let slot = slots[k];
                let start = new Date(slot.start);
                let end = new Date(slot.end);

                const range = moment.range(start, end);
                const range1 = moment.range(startT, endT);

                  if(range.overlaps(range1)){
                    // slotArray[j].slots[k].name = event.Subject;
                    slotArray[j].slots[k].available = false;
                    let next = new Date(now.getFullYear(), now.getMonth(),  now.getDate()+60)
                    if(start.getTime()<=next.getTime()) {
                      // recent 60day/ 2 month will reserve.
                      console.log("reserve:"+start.toString());
                      setTimeout(booking.bookSchedule,j*10+k*30,slotArray[j].slots[k],authToken,function(){});
                    }
                  }
                }//k
              }//j
            }// i


            filter(slotArray,authToken);

            let jsonResult = {
              'items':officeHourArray,
              'booking': slotArray,
              'updateTime':new Date().toISOString()
            };
            fs.writeFileSync('./data/pub_calendar.json',JSON.stringify(jsonResult),'utf8');

          });


        }// else

    });
}
