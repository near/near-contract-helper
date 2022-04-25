pipeline {
    agent any
    environment {
        AWS_CREDENTIALS = 'aws-credentials-password'
        AWS_REGION = 'us-west-2'
        AWS_TESTNET_ROLE = credentials('testnet-assumed-role')
        AWS_TESTNET_ROLE_ACCOUNT = credentials('testnet-assumed-role-account')
        AWS_MAINNET_ROLE = credentials('mainnet-assumed-role')
        AWS_MAINNET_ROLE_ACCOUNT = credentials('mainnet-assumed-role-account')

        TESTNET_ECR_REPOSITORY = 'testnet-ecr-repository'
        TESTNET_ECS_CLUSTER = 'testnet-cluster'
        TESTNET_ECS_LIVE_SERVICE = 'testnet-live-backend-service'
        TESTNET_ECS_STAGING_SERVICE = 'testnet-staging-backend-service'
        MAINNET_ECR_REPOSITORY = 'mainnet-ecr-repository'
        MAINNET_ECS_CLUSTER = 'mainnet-cluster'
        MAINNET_ECS_LIVE_SERVICE = 'mainnet-live-backend-service'
        MAINNET_ECS_STAGING_SERVICE = 'mainnet-staging-backend-service'
    }
    stages {
        stage('backend:test') {
            steps {
                milestone(1)
                sh "yarn && yarn test"
            }
        }
        stage('backend:build') {
            steps {
                milestone(2)
                sh "docker build . --tag $TESTNET_ECR_REPOSITORY"
                sh "docker build . --tag $MAINNET_ECR_REPOSITORY"
            }
        }
        stage('backend:deploy:testnet') {
            when {
                branch 'master'
            }
            steps {
                withAWS(
                    region: env.AWS_REGION,
                    credentials: env.AWS_CREDENTIALS,
                    role: env.AWS_TESTNET_ROLE,
                    roleAccount: env.AWS_TESTNET_ROLE_ACCOUNT
                ) {
                    milestone(3)
                    sh 'ecs-cli configure profile' // initialize ecs-cli with AWS credentials injected by outer withAWS block
                    sh "ecs-cli push $TESTNET_ECR_REPOSITORY"
                    sh "aws ecs update-service --service $TESTNET_ECS_STAGING_SERVICE --cluster $TESTNET_ECS_CLUSTER"
                    input(message: 'Deploy to testnet?')
                    sh "aws ecs update-service --service $TESTNET_ECS_LIVE_SERVICE --cluster $TESTNET_ECS_CLUSTER"
                }
            }
        }
        stage('backend:deploy:mainnet') {
            // TODO change to `branch 'master'` once trunk-based development is ready
            when {
                branch 'stable'
            }
            steps {
                withAWS(
                    region: env.AWS_REGION,
                    credentials: env.AWS_CREDENTIALS,
                    role: env.AWS_MAINNET_ROLE,
                    roleAccount: env.AWS_MAINNET_ROLE_ACCOUNT
                ) {
                    milestone(4)
                    sh 'ecs-cli configure profile' // initialize ecs-cli with AWS credentials injected by outer withAWS block
                    sh "ecs-cli push $MAINNET_ECR_REPOSITORY"
                    sh "aws ecs update-service --service $MAINNET_ECS_STAGING_SERVICE --cluster $MAINNET_ECS_CLUSTER"
                    input(message: 'Deploy to mainnet?')
                    sh "aws ecs update-service --service $MAINNET_ECS_LIVE_SERVICE --cluster $MAINNET_ECS_CLUSTER"
                }
            }
        }
    }
    post {
        always {
            cleanWs(
                disableDeferredWipeout: true,
                deleteDirs: true
            )
        }
    }
}
