EWS-Calendar

```
## production.sh
#!/usr/bin/env bash
export NODE_ENV=production
export NODE_CLUSTER_SCHED_POLICY=rr
pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" --cron "0 */3 * * *" -n auCalProcess  getCalendar.js #every 3 hour
pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" --cron "5 8 * * 0" -n getHoliday  getHoliday.js #every week

pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" --cron "0 1 * * *" -n syncGoogleCal  syncGoogleCal.js #at 1 am

pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" -n auCalServer server.js #always on
```
## config.json

```
{
    "useraccount": "LoginAccount",
        "password": "encoded password",
        "host": "https://doamin",
        "targetCalendar": "target@example.com",

        "calendarId": "xxxxxx@group.calendar.google.com",

		 "mailgunKey":"key-xxxxxxx",
		 "mailgunDomain":"domain",
		 "mailgunTarget":["admin@example.com","test@example.com"],

        "reserveAccount":"test",
        "reservePassword":"test",
        "reserveDay":90
}
```
