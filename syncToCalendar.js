const ews = require('./EWS-Calendar.js');

ews.fetchCalendar('2021-02-27', '2021-02-28', item=> {
    console.dir(item, {depth:null});
});


let title = "社創中心週三拜會: Peter Lee"
let content = `
測試內容
社創中心週三拜會: Peter lee 預約
時間: Wed Mar 10 2021 11:00:00 GMT+0800 (Taipei Standard Time)
預約者: 小明
email: test@gmail.com
行動電話: 011111
單位: 11111
拜會內容: xx  記錄方式：錄影
`
let startTime = '2021-02-27T18:10:00';
let endTime = '2021-02-27T19:10:00';
ews.writeToCalendar(startTime, endTime, title, content);
