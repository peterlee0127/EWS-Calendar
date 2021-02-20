const Koa = require('koa');
const app = new Koa();
const bodyParser = require('koa-bodyparser');
const fs = require('fs');
const booking = require('./booking.js');
const config = require('./config.js');
const reserveDay = config.reserveDay;

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});
app.use(bodyParser());

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

async function reserve(body) {
  return new Promise((resolve, reject) => {
    booking.bookSchedule(body,function(response) {
      resolve({"message":response})
    });
 });
}

async function getReserve(body) {
  return new Promise((resolve, reject) => {
    booking.getReservations(function(body){
        resolve(body)
    });
 });
}

app.use(async (ctx, next)  => {
  if(ctx.method=='GET'){
    if(ctx.url=='/auCal'){
      let result = await readCalendar('./data/pub_calendar.json');
      ctx.body = result;
    }
  }
  if(ctx.method=='GET'){
    if(ctx.url=='/getReserve'){
      let result = await getReserve(ctx.request.body);
      ctx.body = result;
    }
  }
  if(ctx.method=='POST'){
    if(ctx.url=='/reserve'){
      let result = await reserve(ctx.request.body);
      ctx.body = result;
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
