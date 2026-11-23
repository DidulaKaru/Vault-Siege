pipeline {
    agent { label 'rootless-docker' }

    environment {
        SOURCE_DIR = '/home/user/Vault-Siege'
    }

    stages {
        stage('Test and Build') {
            steps {
                deleteDir()
                sh '''
                    set -e
                    tar -C "$SOURCE_DIR" --exclude=node_modules --exclude=dist --exclude='.env*' -cf - client server | tar -xf -

                    docker run --rm -v "$PWD/server:/app" -w /app node:22-alpine \
                        sh -c 'npm ci && npm test'

                    docker run --rm -v "$PWD/client:/app" -w /app node:22-alpine \
                        sh -c 'npm ci && npm run lint && npm test && npm run build'
                '''
            }
        }
    }

    post {
        success {
            build job: 'vault-siege-dockerhub', wait: false
        }
    }
}