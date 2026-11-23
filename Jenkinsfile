pipeline {
    // Run only on the agent that uses rootless Docker.
    agent { label 'rootless-docker' }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        // The project already lives on the lab machine; the agent runs as "user".
        REPO_DIR = '/home/user/Documents/DevOps Group 30/Vault-Siege'

        // Host port for the frontend: >= 1024 (rootless Docker), not 8080/8081/8082.
        // Docker Compose gives shell variables priority over .env, so .env stays untouched.
        APP_PORT = '8083'
    }

    stages {
        stage('Verify project') {
            steps {
                dir(env.REPO_DIR) {
                    sh '''
                        pwd
                        ls docker-compose.yml server/Dockerfile client/Dockerfile
                        git log -1 --oneline || true
                    '''
                }
            }
        }

        stage('Test') {
            steps {
                // Work on a copy in the Jenkins workspace so node_modules/dist
                // never end up in your project folder.
                sh '''
                    set -e
                    rm -rf test-copy
                    mkdir test-copy
                    tar -C "$REPO_DIR" --exclude=node_modules --exclude=dist --exclude='.env*' \
                        -cf - client server | tar -C test-copy -xf -

                    docker run --rm -v "$PWD/test-copy/server:/app" -w /app node:22-alpine \
                        sh -c 'npm ci && npm test'

                    docker run --rm -v "$PWD/test-copy/client:/app" -w /app node:22-alpine \
                        sh -c 'npm ci && npm run lint && npm test && npm run build'
                '''
            }
        }

        stage('Prepare .env') {
            steps {
                dir(env.REPO_DIR) {
                    // Keep an existing .env. Only create one from the template if missing,
                    // and remember that we did so we can remove it afterwards.
                    sh '''
                        if [ -f .env ]; then
                            echo "Using existing .env"
                        else
                            cp .env.example .env
                            touch .env.created-by-jenkins
                            echo "Created .env from .env.example"
                        fi
                        docker compose config --services
                    '''
                }
            }
        }

        stage('Build & Start') {
            steps {
                dir(env.REPO_DIR) {
                    sh '''
                        docker compose down --remove-orphans
                        docker compose up -d --build
                        docker compose ps
                    '''
                }
            }
        }

        stage('Health checks') {
            steps {
                sh '''
                    wait_for() {
                        for i in $(seq 1 30); do
                            if curl -fsS "$1" > /dev/null; then echo "OK: $1"; return 0; fi
                            echo "Waiting for $1 ($i/30)..."; sleep 5
                        done
                        echo "FAILED: $1"; return 1
                    }
                    wait_for http://localhost:5000/health
                    wait_for "http://localhost:${APP_PORT}/"
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                dir(env.REPO_DIR) {
                    // 'dockerhub-creds' = Jenkins credential (username + access token).
                    // Single quotes: the shell reads the secret, Groovy never sees it.
                    withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                                      usernameVariable: 'DH_USER',
                                                      passwordVariable: 'DH_TOKEN')]) {
                        sh '''
                            set -e
                            trap 'docker logout || true' EXIT

                            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin

                            for svc in backend frontend; do
                                id=$(docker compose images -q "$svc")
                                repo="$DH_USER/vault-siege-$svc"
                                docker tag "$id" "$repo:$BUILD_NUMBER"
                                docker tag "$id" "$repo:latest"
                                docker push "$repo:$BUILD_NUMBER"
                                docker push "$repo:latest"
                            done
                        '''
                    }
                }
            }
        }
    }

    post {
        failure {
            dir(env.REPO_DIR) { sh 'docker compose logs --no-color --tail=100 || true' }
        }
        always {
            dir(env.REPO_DIR) {
                // Stop the stack. Volumes are kept (no -v) so your local database survives.
                sh '''
                    docker compose down --remove-orphans || true
                    if [ -f .env.created-by-jenkins ]; then
                        rm -f .env .env.created-by-jenkins
                    fi
                '''
            }
            sh 'rm -rf test-copy'
        }
    }
}
