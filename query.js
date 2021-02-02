const axios = require('axios');

axios({
    method: 'get',
    url: 'http://localhost:8082/getReserve'
})
  .then(function (response) {
    // handle success
   let data = response.data;
   data = data.reservations.filter(_=>_.startDate.split("T")[0]=="2020-10-14")
    console.log(data);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .then(function () {
    // always executed
  });