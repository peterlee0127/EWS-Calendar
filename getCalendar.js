const config = require('./config.js');
const ewsCalendar = require('./EWS-Calendar.js');
const booking = require('./booking.js');
const fs = require('fs');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const reserveDay = config.reserveDay;
const now = new Date();

let start = new Date(now.getFullYear(), now.getMonth(), now.getDate()-reserveDay/2);
let end = new Date(now.getFullYear(), now.getMonth() , now.getDate()+reserveDay*2);
console.log(start.toString()+"-->"+end.toString());
const reserveEndDate = new Date(now.getFullYear(), now.getMonth() ,now.getDate()+95);
// 開放最近90天

function loadCalendar() {
  ewsCalendar.fetchCalendar(start.toISOString(),end.toISOString(),function(calendar) {
    if (!calendar) {
      console.error("error");
      console.error(calendar);
      return;
    }
    if(JSON.stringify(calendar).length<10) {
      console.error('calendar length is not correct');
      return;
    }
    processPublicCalendar(JSON.stringify(calendar));

    var jsonResult = {
      'items': calendar,
      'updateTime': new Date().toISOString()
    };
    fs.writeFileSync('./data/pri_calendar.json',JSON.stringify(jsonResult),'utf8');
  });
}
loadCalendar();

function test(){
  let calendar = fs.readFileSync('./data/pri_calendar.json','utf8');
  calendar = JSON.parse(calendar).items;
  processPublicCalendar(JSON.stringify(calendar)); 

}
//test();

function getTimeSlot(dict) {
  // if(dict.holiday) {return;}
  let startT = new Date(dict.start);
  let available = false;
  //let next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+reserveDay);
  let next = reserveEndDate;
  if (new Date(startT).getTime()<=next.getTime()) {
    // recent 14 day can reserve.
    available = true;
  }
  let endT = new Date(dict.end);
  let times = endT.getTime()/1000-startT.getTime()/1000;
  let numOfSlot = times/(60*60);  // 60min per slot
  let slot = [];
  for (let j=0;j<numOfSlot;j++) {
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
  const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  //const endD = new Date(now.getFullYear(), now.getMonth() , now.getDate()+120);  // 3 month
  const endD = reserveEndDate;  
  let start = moment(startD);
  let end = moment(endD);

  var arr = [];
  let tmp = start.clone().day(3);
  if (tmp.isAfter(start, 'd')) {
    arr.push({
      'morningExist': false,
      'afternoonExist': false,
      'exist': false,
      'time': tmp.format('YYYY-MM-DD')
    });
  }
  while (tmp.isBefore(end)) {
    tmp.add(7, 'days');
    arr.push({
      'morningExist': false,
      'afternoonExist': false,
      'exist': false,
      'time': tmp.format('YYYY-MM-DD')
    });
  }
  return arr;
}

function filterWednesdayNotBooking(bookingHourArray,authToken) {
  let wednesdays = getWednesday();
  for (let i=0;i<wednesdays.length;i++) {
    for (let j=0;j<bookingHourArray.length;j++) {
      let slot = bookingHourArray[j].slots[0].start;
      if (new Date(slot).getDateStr()==new Date(wednesdays[i].time).getDateStr()) {
        if(bookingHourArray[j].morning) {
          wednesdays[i].morningExist = true;
        }else {
          wednesdays[i].afternoonExist = true;
        }
      }
    }
  }
  // console.dir(wednesdays,{depth:null});

  for (let i=0;i<wednesdays.length;i++) {
    if (wednesdays[i].afternoonExist==false) {
        let time = new Date(wednesdays[i].time);
        let dict = {
          start: time.setHours("13"),
          end: time.setHours("17")
        };
    
        let slots = getTimeSlot(dict);
        for (let k=0;k<slots.length;k++) {
          let slot = slots[k];
          setTimeout(booking.bookSchedule, k*30, slot, authToken, function(){});
      }
    }
  }

  for (let i=0;i<wednesdays.length;i++) {
    if (wednesdays[i].morningExist==false) {
        let time = new Date(wednesdays[i].time);
        let dict = {
          start: time.setHours("10"),
          end: time.setHours("12")
        };
        let slots = getTimeSlot(dict);
        for (let k=0;k<slots.length;k++) {
          let slot = slots[k];
          setTimeout(booking.bookSchedule, k*30, slot, authToken, function(){});
        }
    }
  }

 
}

function filterWednesdayHoliday(holidayArray,authToken) {
  let wednesdays = getWednesday();
  let k = 0;
  for (let i = 0; i < wednesdays.length; i++) {
    for (let j = 0; j < holidayArray.length; j++) {
      let slotDate = moment(holidayArray[j].date, 'YYYY/M/D');
      //勞動節要上工
      if (moment(slotDate).format('YYYY-MM-DD') == wednesdays[i].time && moment(slotDate).format('MM-DD') != "05-01") {
        let time = new Date(wednesdays[i].time);
        //搭配前臺能處理起訖跨多個時段時
        let dict = {
          start: time.setHours("10"),
          end: time.setHours("17"),
          name: "國定假日",
          username: "已預約",
          email: "可聯繫的email",
          mobile: "可聯繫的行動電話",
          department: "單位名稱",
          description: "已預約"
        };
        setTimeout(booking.bookSchedule, k*30, dict, authToken, function(){});
        k++;
      }
    }
  }
}

function processPublicCalendar(json,callback) {
  let officeHourArray = [];
  let bookingHourArray = [];
  let otherEvent = [];
  const items = JSON.parse(json);
  for (var i=0;i<items.length;i++) {
    const item = items[i];
    const day = new Date(item['Start']).getDay();
    if (day==3) {
      let dict = {
        'Subject': item.Subject,
        start: item.Start,
        end: item.End,
        holiday: false
      };
      //console.log(item['Start']+" "+item.Subject);
      let itemSubject = item.Subject;

      if (itemSubject == '[au] 空總 Office Hour-booking-上午') {
        // officeHourArray.push(dict);
        let time = new Date(item['Start']);
        dict.start = time.setHours("10");
        dict.end = time.setHours("12");
        dict.morning = true;
        dict.afternoon = false;
        bookingHourArray.push(dict);
      }
      else if (itemSubject == '[au] 空總 Office Hour-booking') {
        //support shrink booking time slot
        //設定下午時段使用同樣區間 支援booking事件起訖縮小時自動預約
        let time = new Date(item['Start']);
        dict.start = time.setHours("13");
        dict.end = time.setHours("17");
        dict.morning = false;
        dict.afternoon = true;
        bookingHourArray.push(dict);
      } else if (/[不無毋][須需]\s*[Aa][Uu]/.exec(itemSubject) == null) {
        otherEvent.push(dict);
      }  // else other event
    }  // day 3
  }

  fs.readFile('./data/holiday.json', "utf8", function(error,holidays) {
    if (error) {
      console.log(error);
      console.log(holidays);
    } else {
	let holidayArray = [];
	/*
      let holidayArray = JSON.parse(holidays);
      holidayArray = holidayArray.filter(item => item.date.split('/')[0] == now.getFullYear() && item.isHoliday == '是');
      // only parse this year's holiday.
      for (var j=0;j<officeHourArray.length;j++) {
        const dict = officeHourArray[j];
        for (var i=0;i<holidayArray.length;i++) {
          const holiday = holidayArray[i];
          const holi = holiday.date.split('/');
          const holidayDate = new Date(holi[1]+'/'+holi[2]+' '+holi[0]);
          if (new Date(dict.start).getDateStr()==holidayDate.getDateStr()) {
            officeHourArray[j].holiday = true;
          }
        }
      }
	*/

      let slotArray = [];
      for (var i=0;i<bookingHourArray.length;i++) {
        let item = bookingHourArray[i];
        slotArray.push({
          "name": item.Subject,
          "morning": item.morning,
          "afternoon": item.afternoon,
          "slots": getTimeSlot(item)
        });
      }

      for (var j=0;j<slotArray.length;j++) {
        const dict = slotArray[j].slots[0];
        for (var i=0;i<holidayArray.length;i++) {
          const holiday = holidayArray[i];
          const holi = holiday.date.split('/');
          const holidayDate = new Date(holi[1]+'/'+holi[2]+' '+holi[0]);
          if (new Date(dict.start).getDateStr()==holidayDate.getDateStr()) {
            slotArray[j].holiday = true;
          }
        }
      }

      booking.getAuthToken(function(authToken) {
        //國定假日可能有行程 放在其他行程前 可預約時段前
        filterWednesdayHoliday(holidayArray,authToken);
        for (var i=0;i<otherEvent.length;i++) {
          let event = otherEvent[i];
          let startT = new Date(event.start);
          let endT = new Date(event.end);
          for (var j=0;j<slotArray.length;j++) {
            let slots = slotArray[j].slots;
            for (var k=0;k<slots.length;k++) {
              let slot = slots[k];
              let start = new Date(slot.start);
              let end = new Date(slot.end);

              const range = moment.range(start, end);
              const range1 = moment.range(startT, endT);

              if (range.overlaps(range1)) {
                // slotArray[j].slots[k].name = event.Subject;
                slotArray[j].slots[k].available = false;
                //let next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+120);
		let next = reserveEndDate;
                if (start.getTime()<=next.getTime()) {
                  // recent 90day/ 3 month will reserve.
                  console.log("reserve:"+start.toString());
                  setTimeout(booking.bookSchedule, j*10+k*30, slotArray[j].slots[k], authToken, function(){});
                }
              }
            }  // k
          }  // j
        }  // i

        filterWednesdayNotBooking(slotArray,authToken);

        let jsonResult = {
          'items': officeHourArray,
          'booking': slotArray,
          'updateTime': new Date().toISOString()
        };
        fs.writeFileSync('./data/pub_calendar.json',JSON.stringify(jsonResult),'utf8');

      });


    }  // else

  });
}
