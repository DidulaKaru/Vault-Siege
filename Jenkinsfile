pipeline {
    agent { label 'rootless-docker' }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        APP_PORT = '8083'
        // Where the project lives on the lab machine (the agent runs as "user")
        REPO_DIR = '/home/user/Vault-Siege'
    }

    stages {
        stage('Prepare .env') {
            steps {
                dir(env.REPO_DIR) {
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
                dir(env.REPO_DIR) {
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
    }

    post {
        failure {
            dir(env.REPO_DIR) { sh 'docker compose logs --no-color --tail=100 || true' }
        }
        always {
            dir(env.REPO_DIR) {
                sh 'docker compose down -v --remove-orphans || true'
                sh 'rm -f .env'
            }
        }
    }
}
