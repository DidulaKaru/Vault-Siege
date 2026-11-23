pipeline {
    // Run only on the agent that uses rootless Docker.
    agent { label 'rootless-docker' }

    environment {
        // Host port for the frontend: >= 1024 (rootless Docker), not 8080/8081/8082.
        APP_PORT = '8083'
    }

    stages {
        stage('Checkout') {
            steps {
                // Cloned by the agent (as "user"), so the Jenkins controller
                // does not need its own access to GitHub.
                sh '''
                    rm -rf repo
                    git clone --depth 1 https://github.com/DidulaKaru/Vault-Siege.git repo
                '''
            }
        }

        stage('Prepare .env') {
            steps {
                dir('repo') {
                    // .env is git-ignored, so build it from the template.
                    // Lab only: use Jenkins credentials for real secrets.
                    sh '''
                        cp .env.example .env
                        sed -i "s/^APP_PORT=.*/APP_PORT=${APP_PORT}/" .env
                        docker compose config --services
                    '''
                }
            }
        }

        stage('Build & Start') {
            steps {
                dir('repo') {
                    sh '''
                        docker compose down -v --remove-orphans
                        docker compose up -d --build
                        docker compose ps
                    '''
                }
            }
        }

        stage('Health checks') {
            steps {
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
        failure {
            dir('repo') { sh 'docker compose logs --no-color --tail=100 || true' }
        }
        always {
            dir('repo') {
                // Stop everything and delete the DB volume so the next run starts clean.
                sh 'docker compose down -v --remove-orphans || true'
                sh 'rm -f .env'
            }
        }
    }
}