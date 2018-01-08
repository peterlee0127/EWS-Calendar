const Koa = require('koa');
const app = new Koa();
const fs = require('fs');

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});


async function readCalendar(path) {
  return new Promise((resolve, reject) => {
      let content =  fs.readFile(path , "utf8",function(error,json){
          if(error){
            console.log(error);resolve(null);
          }else {
            resolve(json);
          }
      });
 })
}

app.use(async (ctx, next)  => {
  if(ctx.method=='GET'){
    if(ctx.url=='/auCal'){
      let result = await readCalendar('./data/pub_calendar.json');
      processCalendar(result,function(json){
            ctx.body = json;
      });
    }
  }
});

app.listen(8082);

const privateServer = new Koa();
privateServer.use(async (ctx, next)  => {
  if(ctx.url=='/calendar'){
    if(ctx.request.header.host=='localhost:8083'){
      let result = await readCalendar('./data/pri_calendar.json');
      ctx.body = result;
    }else {
        ctx.body = 'API only work with localhost'
     }
  }
});
// Not explose with nginx.
privateServer.listen(8083);
