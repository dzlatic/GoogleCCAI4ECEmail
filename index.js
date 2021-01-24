const express = require('express');
const { eceLogin, getEmailIntent, getEmailTopic, getEmailSentiment } = require('./restFunctions');
const app = express();
const SERVICE_PORT = process.env.SERVICE_PORT;
const REQUIRE_TIMESTAMPS = process.env.REQUIRE_TIMESTAMPS;

if (REQUIRE_TIMESTAMPS === "Yes") {
  require('log-timestamp');
}

let Xegainsession = '';
 
app.get('/', function (req, res) {
  res.send('ECE Email Routing Server is Ready');
})

app.get('/sentiment/:activityID', async function (req, res) {
  const activityId = req.params.activityID;
  Promise.resolve(getEmailSentiment({activityId,Xegainsession}))
  .then( response => {
    console.log(`Processing get sentiment for ActivityID ${activityId} and sending response:`);
    console.log(response);
    res.status=200;
    res.send(response);
  })
  .catch( error => {
    console.error(error);
    res.status=500;
    res.send(error)
  })
})

app.get('/intent/:activityID', async function (req, res) {
  const activityId = req.params.activityID;
  Promise.resolve(getEmailIntent({activityId,Xegainsession}))
  .then( response => {
    console.log(`Processing get intent for ActivityID ${activityId} and sending response:`);
    console.log(response);
    res.status=200;
    res.send(response);
  })
  .catch( error => {
    console.error(error);
    res.status=500;
    res.send(error);
  })
})

app.get('/topic/:activityID', async function (req, res) {
  const activityId = req.params.activityID;
  Promise.resolve(getEmailTopic({activityId,Xegainsession}))
  .then( response => {
    console.log(`Processing get classification for ActivityID ${activityId} and sending response:`);
    console.log(response);
    res.status=200;
    res.send(response);
  })
  .catch( error => {
    console.error(error);
    res.status=500;
    res.send(error)
  })
})

Promise.resolve(eceLogin())
  .then(function (response) {
    if(response.status === 204){
      Xegainsession = response.headers['x-egain-session'];
      app.listen(SERVICE_PORT);
      console.log('ECE Email Routing Server is Ready, on port:',SERVICE_PORT);
    }
    else {
      console.log('Error: cannot connect to ECE server');
    }
  })
  .catch(err=> console.error(err));




