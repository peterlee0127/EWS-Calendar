const Koa = require('koa');
const app = new Koa();
const fs = require('fs');

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});

function processCalendar(json,callback) {
  var array = [];
  const obj = JSON.parse(json);
  const items = obj.items;
  const updateTime = obj.updateTime;
    for(var i=0;i<items.length;i++){
      const item = items[i];
      const day = new Date(item['Start']).getDay();
      if(day==3){
        var dict = {
          'Subject': item.Subject,
          start: item.Start,
          end: item.End
        };
        if(item.Subject=='[au] 空總 Office Hour'){
          array.push(dict);
        }
      }
    }
    callback({
      'items':array,
      'updateTime':new Date(updateTime).toISOString()
    });
}

async function readCalendar() {
  return new Promise((resolve, reject) => {
      let content =  fs.readFile( './calendar.json', "utf8",function(error,json){
          if(error){
            console.log(error);resolve(null);
          }else {
            processCalendar(json,function(result){
                resolve(result);
            });
          }
        });
 })
}


app.use(async (ctx, next)  => {
    if(ctx.url=='/auCal' && ctx.method=='GET'){
      let result = await readCalendar();
      ctx.body = result;
      /*
        readCalendar(function(json){
            if(json!=null){
                ctx.body = JSON.stringify(json);
            }else {
                ctx.body = 'auCal';
            }
        });
        */
    }
});

app.listen(8082);
