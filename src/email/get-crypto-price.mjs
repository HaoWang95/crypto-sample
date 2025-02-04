import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import validator from "validator";

const writeToTable = process.env.WRITE_TO_TABLE;

// export ses instance from a separate file
const emailCharSet = "utf-8";
const emailService = new SESClient({ region: "ap-southeast-2" });

const createSendEmailCommand = (toAddress, cryptoCoin, price) => {
  return new SendEmailCommand({
    Destination: {
      ToAddresses: [toAddress],
    },
    // hard code value for quick debugging
    Source: "alanwang0028@gmail.com",
    Message: {
      Subject: {
        Charset: emailCharSet,
        Data: `Thank you for querying ${cryptoCoin}`,
      },
      Body: {
        Text: {
          Charset: emailCharSet,
          Data: `The current price for ${cryptoCoin} is $${price} in AUD`,
        },
      },
    },
  });
};

const sendCryptoEmail = async (toAddress, cryptoCoin, price) => {
  try {
    const sendCommand = createSendEmailCommand(toAddress, cryptoCoin, price);
    const sendResult = await emailService.send(sendCommand);
    console.info(`get-crypto-price email MessageId: ${sendResult.MessageId}`);
    return sendResult;
  } catch (emailErr) {
    console.error(`get-crypto-price email error: ${emailErr}`);
    return emailErr;
  }
};
// export dynamodb instance from a separate file
const dynamoDbPutClient = new DynamoDBClient({});
const putDbClient = DynamoDBDocumentClient.from(dynamoDbPutClient);

export const getCryptoPrice = async (event, context) => {
  const crypto = event?.queryStringParameters?.crypto;
  const email = event?.queryStringParameters?.email;

  console.info(`request crypto query: ${crypto}`);
  console.info(`request email query: ${email}`);

  if (crypto && email && validator.isEmail(email)) {
    try {
      let resp = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${crypto}&vs_currencies=aud`,
        {
          headers: {
            Accept: "application/json",
            // hard code it here to escape kms call
            "x-cg-api-key": "CG-4X71JN6UhfqxchmU7gxJ9pFk",
          },
        }
      );

      const coinPriceAud =
        resp?.data?.[crypto]?.["aud"] ?? "not returned from coingecko";
      const emailResponse = await sendCryptoEmail(email, crypto, coinPriceAud);
      console.info(`Sent ${emailResponse.MessageId}`);

      // update dynamo record
      const current = Date.now();
      console.info(`current timestamp is ${current}`);
      // any need to store the price record for a specific coin
      const putItemCommand = new PutCommand({
        TableName: writeToTable,
        Item: {
          user: email,
          timestamp: current.toString(),
          crypto: crypto,
        },
      });
      const putResult = await putDbClient.send(putItemCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "In case of email issues, crypto result is returned",
          dynamoDbResult: putResult,
          emailResult: emailResponse,
          data: resp.data,
        }),
        // body: JSON.stringify(resp.data),
      };
    } catch (err) {
      console.error(`Error when executing request ${err}`);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Internal server error",
          details: err,
        }),
      };
    }
  }
  return {
    statusCode: 400,
    body: JSON.stringify({
      message:
        "This is a generic message indicating that either query string crypto or email is missing or is invalid.",
    }),
  };
};
