const axios = require('axios');
const util = require('util');
const https = require('https');
const fs = require('fs');
const API = require('./ECE_API');
const NodeCache = require( "node-cache" );
const {getDialogFlowIntent} = require('./dialogFlowClient');
const language = require('@google-cloud/language');

require('dotenv').config();

const ECE_SERVER = process.env.ECE_SERVER;
const ECE_USER_NAME = process.env.ECE_USER_NAME;
const ECE_USER_PASSWORD = process.env.ECE_USER_PASSWORD;
const ECE_SEREVER_CERTIFICATE_PATH = process.env.ECE_SEREVER_CERTIFICATE_PATH;

let eceClient = null;
const emailBodyCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } );
const googleIntentCache = new NodeCache( { stdTTL: 3600, checkperiod: 4000 } );
const googleTopicCache = new NodeCache( { stdTTL: 3600, checkperiod: 4000 } );
const googleSentimentCache = new NodeCache( { stdTTL: 3600, checkperiod: 4000 } );

const googleClient = new language.LanguageServiceClient();

const errorHandler = (error) => {
  if (error.response) {
    return util.format("Error code: %s, reason %s, description: %s", error.response.status, error.response.data.error, error.response.data.error_description);
  } else if (error.request) {
    return util.format("Request error: %s", error.code);
  } else if (error.message){
    return util.format("Error: %s", error.message);
  } else {
    return util.format("Error: %s", error);
  }
};

const eceLogin = async() => {
    const loginData = `{'userName': ${ECE_USER_NAME},'password': ${ECE_USER_PASSWORD}}`;
    const loginURL = ECE_SERVER + API.AuthenticateUser + '?forceLogin=yes';
    try {
      eceClient = new https.Agent({  
        ca: [fs.readFileSync(ECE_SEREVER_CERTIFICATE_PATH)],
        rejectUnauthorized: true,
      });
      const config = {
        method: 'post',
        url: loginURL,
        httpsAgent: eceClient,
        headers: { 
          'Accept': 'application/json', 
          'Content-type': 'application/json', 
          'Accept-Language': 'en-US'
        },
        data : loginData
      };
      return axios(config)
        .then(response => response)
        .catch(error => errorHandler(error))
    } catch (err) {
      if (err.code === 'ENOENT') {
        return Promise.reject("ECE Server Certificate file not found.");
      } else {
        return Promise.reject("Error: cannot even try to connect to ECE server.");
      }
    }

}

const getEmailBody = async({activityId, Xegainsession}) => {
    const emailBody = emailBodyCache.get( activityId );
    if ( emailBody == undefined ){
      const loginURL = ECE_SERVER + API.GetActivity + `/${activityId}?$attribute=payload`;
      const config = {
        method: 'get',
        url: loginURL,
        httpsAgent: eceClient,
        headers: { 
          'Accept': 'application/json', 
          'X-egain-session': Xegainsession, 
          'Accept-Language': 'en-US'
        }
      };
      const response = await axios(config);
      const emailBody = response.data.activity[0].payload.email.contents.content[0].value;
      emailBodyCache.set( activityId, emailBody );
      console.info("==========================> Processing new email" );
      console.log(`ActivityID ${activityId} has the following email body: ${emailBody}`);
      return emailBody;
  }
  else {
    return emailBody;
  }
};

const getEmailIntent = async({activityId, Xegainsession}) => {
    const intentResult = googleIntentCache.get( activityId );
    if ( intentResult == undefined ){
        try {
            const emailBody = await getEmailBody({activityId, Xegainsession});
            const intent = await getDialogFlowIntent([emailBody]);
            const result = { intent: intent };
            googleIntentCache.set( activityId, result );
            return result;
        }
        catch (error)
        {
            const error_description = errorHandler(error);
            console.error(`Error retriving the intent for ActivityID ${activityId}: ${error_description}`);
            return {intent: "" };
        }
    } else {
        return intentResult;
    }
};

const getEmailTopic = async({activityId, Xegainsession}) => {
    const topicResult = googleTopicCache.get( activityId );
    if ( topicResult == undefined ){
        try {   
              const emailBody = await getEmailBody({activityId, Xegainsession});
              const document = {
                  content: emailBody,
                  type: 'PLAIN_TEXT',
              };
              const [classification] = await googleClient.classifyText({document});
              if(classification.categories[0]){
                  const topic = classification.categories[0].name;
                  const result = { topic: topic };
                  googleTopicCache.set( activityId, result );
                  return result;
              }
              else {
                  console.error(`Error retriving the topic for ActivityID ${activityId}: Invalid text content: too few tokens (words) to process`);
                  return { topic: "" };
              }
          }
          catch (error)
          {
              const error_description = errorHandler(error);
              console.error(`Error retriving the topic for ActivityID ${activityId}: ${error_description}`);
              return { topic: "" };
          }  
      } else {
          return topicResult;
      }
};

const getEmailSentiment = async({activityId, Xegainsession}) => {
    const sentimentResult = googleSentimentCache.get( activityId );
    if ( sentimentResult == undefined ){    
        try {
            const emailBody = await getEmailBody({activityId, Xegainsession});
            const document = {
                content: emailBody,
                type: 'PLAIN_TEXT',
            };
            const [result] = await googleClient.analyzeSentiment({document});
            const sentiment = result.documentSentiment;
            if(sentiment){
                const score = Math.round(sentiment.score * 100);
                const magnitude = Math.round(sentiment.magnitude * 100);
                const scoreMagnitude = `${score}/${magnitude}`;
                return { sentiment: scoreMagnitude };
            }
            else {
                console.error(`Error retriving the sentiment for ActivityID ${activityId}: Cannot retrieve sentiment`)
                return { sentiment: "" };
            }
        }
        catch (error)
        {
            const error_description = errorHandler(error);
            console.error(`Error retriving the sentiment for ActivityID ${activityId}: ${error_description}`)
            return { sentiment: "" };
        }
    } else {
      return sentimentResult;
    }
};

exports.eceLogin = eceLogin;
exports.getEmailIntent = getEmailIntent;
exports.getEmailTopic = getEmailTopic;
exports.getEmailSentiment = getEmailSentiment;

