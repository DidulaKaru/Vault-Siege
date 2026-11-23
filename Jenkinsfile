pipeline {
    // Run only on the agent that uses rootless Docker (label set in Jenkins node config).
    agent { label 'rootless-docker' }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        // Host port for the frontend. Must be >= 1024 (rootless Docker) and not
        // clash with Jenkins (8080/8081) or the other lab services (8082).
        APP_PORT = '8083'
    }

    stages {
        stage('Prepare .env') {
            steps {
                // .env is git-ignored, so build it from the template.
                // Lab only: for real secrets use Jenkins credentials instead.
                sh '''
                    cp .env.example .env
                    sed -i "s/^APP_PORT=.*/APP_PORT=${APP_PORT}/" .env
                    docker compose config --services
                '''
            }
        }

        stage('Build & Start') {
            steps {
                sh '''
                    docker compose down -v --remove-orphans
                    docker compose up -d --build
                    docker compose ps
                '''
            }
        }

        stage('Health checks') {
            steps {
                sh '''
                    wait_for() {
                        url="$1"
                        for i in $(seq 1 30); do
                            if curl -fsS "$url" > /dev/null; then
                                echo "OK: $url"
                                return 0
                            fi
                            echo "Waiting for $url ($i/30)..."
                            sleep 5
                        done
                        echo "FAILED: $url"
                        return 1
                    }

                    wait_for http://localhost:5000/health
                    wait_for "http://localhost:${APP_PORT}/"
                '''
            }
        }
    }

    post {
        failure {
            sh 'docker compose logs --no-color --tail=100 || true'
        }
        always {
            // Stop everything and delete the DB volume so the next run starts clean.
            sh 'docker compose down -v --remove-orphans || true'
            sh 'rm -f .env'
        }
    }
}
