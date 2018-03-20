const config = require('./config.js').config;
const ewsCalendar = require('./EWS-Calendar.js');


const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(),  now.getDate()-2  );
const end = new Date(now.getFullYear(), now.getMonth()+6 , 1);
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
