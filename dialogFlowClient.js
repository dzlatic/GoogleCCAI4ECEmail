//if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
//}

const dialogflow = require('@google-cloud/dialogflow');
const sessionClient = new dialogflow.SessionsClient();

async function detectIntent(
    projectId,
    sessionId,
    query,
    contexts,
    languageCode
) {
    // The path to identify the agent that owns the created intent.
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        sessionId
    );

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: query,
                languageCode: languageCode,
            },
        },
    };

    if (contexts && contexts.length > 0) {
        request.queryParams = {
        contexts: contexts,
        };
    }

    const responses = await sessionClient.detectIntent(request);
    return responses[0];
}

async function getDialogFlowIntent(queries) {
    let intentResponse;
    for (const query of queries) {
        try {
            intentResponse = await detectIntent(
                process.env.GOOGLE_CLOUD_PROJECT_ID,
                process.env.GOOGLE_CLOUD_SESSION_ID,
                query,
                null,
                process.env.DIALOGFLOW_LANGUAGE_CODE
            );
            const intent = intentResponse.queryResult.intent.displayName;
            if(intent) {
              return intent;
            }
            else {
              return "";
            }

        } catch (error) {
            console.error(error);
        }
  }
}

exports.getDialogFlowIntent = getDialogFlowIntent;