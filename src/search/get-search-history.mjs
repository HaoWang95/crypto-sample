import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const readFromTable = process.env.READ_FROM_TABLE;


const dynamoDbReadClient = new DynamoDBClient({});
const dbQueryClient = DynamoDBDocumentClient.from(dynamoDbReadClient);

export const getSearchHistory = async (event, context) => {
  const userEmail = event?.queryStringParameters?.email;
  if (userEmail) {
    // log out for cloudwatch
    console.info(`get-search-history: req user email is ${userEmail}`);
    const current = Date.now().toString();
    const getCommand = new QueryCommand({
      TableName: readFromTable,
      KeyConditionExpression: "#user = :user AND #timestamp < :timestamp",
      ExpressionAttributeNames: {
        "#user": "user",
        "#timestamp": "timestamp",
      },
      ExpressionAttributeValues: {
        ":user": userEmail,
        ":timestamp": current,
      },
    });
    try {
      let result = await dbQueryClient.send(getCommand);
      console.log(result);
      return {
        statusCode: 200,
        body: JSON.stringify({
          records: result,
        }),
      };
    } catch (err) {
      console.error(
        `An error occurred when querying SearchHistoryTable: ${err}`
      );
      return {
        statusCode: "502",
        body: JSON.stringify({
          errorMessage: err,
        }),
      };
    }
  }
  return {
    statusCode: 400,
    body: JSON.stringify({
      message: "Please use GET request with email query string to search operation history endpoint",
    }),
  };
};
