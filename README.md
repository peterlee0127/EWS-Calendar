EWS-Calendar

```
## production.sh
pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" --cron "0 * * * *" -n auCalProcess  getCalendar.js #every hour
pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" --cron "5 8 * * 0" -n getHoliday  getHoliday.js #every week

pm2 start --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z" -n auCalServer server.js #always on
```

```
##config.js
const key = require('./key.js');  // key.js can encrypt,decrypt your password.

const config = {
  useraccount:'', // your exchange account
  password:'',   // your exchange password
  host: '',      // your exchange server
  targetCalendar: ''  // target's email address
}
exports.config = config;
```

Curently, getHoliday.js will not work in some server. Due to outgoing http request may block by firewall.