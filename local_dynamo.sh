#!/usr/bin/env bash
set -euo pipefail # Bash "strict mode"
script_dirpath="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

AWS_HOME="$HOME/.aws"
AWS_CREDS_FILE='credentials'

DYNAMO_DB_DIRPATH="$script_dirpath"
DYNAMODB_PORT='7877'

# setup aws cedentials file
# values don't matter here because we're using local dynamodb, but it needs to be present
mkdir $AWS_HOME
echo '[default]' > $AWS_HOME/$AWS_CREDS_FILE
echo 'aws_access_key_id=NOT_USED_BUT_NEED_TO_BE_THERE' >> $AWS_HOME/$AWS_CREDS_FILE
echo 'aws_secret_access_key=NOT_USED_BUT_NEED_TO_BE_THERE' >> $AWS_HOME/$AWS_CREDS_FILE

# start dynamodb on port 7877
java -Djava.library.path=$DYNAMO_DB_DIRPATH/DynamoDBLocal_lib -jar $DYNAMO_DB_DIRPATH/DynamoDBLocal.jar -sharedDb -port $DYNAMODB_PORT > $DYNAMO_DB_DIRPATH/dynamodb.log 2>&1 &
