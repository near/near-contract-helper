FROM nearprotocol/bridge as bridge
FROM node:12

# dynamodb local setup
WORKDIR /usr/dynamodb
RUN curl -XGET https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz > dynamodb_local_latest.tar.gz
RUN tar zxvf dynamodb_local_latest.tar.gz
RUN apt update && apt install default-jre -y
COPY ./local_dynamo.sh .

WORKDIR /usr/app
COPY ./package.json .
COPY ./yarn.lock .
RUN yarn
COPY . .
RUN grep -v ACCOUNT_CREATOR_KEY .env.sample | grep -v NODE_URL | grep -v INDEXER_DB_CONNECTION > .env
COPY --from=bridge /root/.near/localnet/node0/validator_key.json . 
RUN ACCOUNT_CREATOR_KEY=$(cat validator_key.json | tr -d " \t\n\r") && echo "ACCOUNT_CREATOR_KEY=$ACCOUNT_CREATOR_KEY" >> .env
CMD ["sh", "-c",  "sleep 10 && yarn start"]
