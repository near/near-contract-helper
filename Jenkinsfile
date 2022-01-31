pipeline {
    agent any
    environment {
        AWS_CREDENTIALS = 'aws-credentials-password'
        AWS_REGION = 'us-west-2'
        AWS_TESTNET_ROLE = credentials('testnet-assumed-role')
        AWS_TESTNET_ROLE_ACCOUNT = credentials('testnet-assumed-role-account')

        ECR_REPOSITORY = 'testnet-ecr-repository'
        ECS_CLUSTER = 'testnet-cluster'
        ECS_LIVE_SERVICE = 'testnet-live-backend-service'
        ECS_STAGING_SERVICE = 'testnet-staging-backend-service'
    }
    stages {
        stage('backend:build') {
            steps {
                sh "docker build . --tag $ECR_REPOSITORY"
            }
        }
        stage('backend:deploy') {
            steps {
                withAWS(
                    region: env.AWS_REGION,
                    credentials: env.AWS_CREDENTIALS,
                    role: env.AWS_TESTNET_ROLE,
                    roleAccount: env.AWS_TESTNET_ROLE_ACCOUNT
                ) {
                    sh 'ecs-cli configure profile' // initialize ecs-cli with AWS credentials injected by outer withAWS block
                    sh "ecs-cli push $ECR_REPOSITORY"
                    sh "aws ecs update-service --service $ECS_STAGING_SERVICE --cluster $ECS_CLUSTER --force-new-deployment"
                    input(message: 'Deploy to testnet?')
                    sh "aws ecs update-service --service $ECS_LIVE_SERVICE --cluster $ECS_CLUSTER --force-new-deployment"
                }
            }
        }
    }
}
