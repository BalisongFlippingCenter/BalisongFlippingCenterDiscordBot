#!/bin/bash
# Runs on the backend EC2 instance (as root, via SSM) to deploy the bot as its
# own compose project. Writes everything it needs each time, so a rebuilt
# instance is fully set up again by the next deploy.
# Usage: remote-deploy.sh <image:tag>
set -euo pipefail

IMAGE="$1"
REGISTRY="${IMAGE%%/*}"
DIR=/home/ec2-user/discord-bot
export AWS_DEFAULT_REGION=us-east-1

mkdir -p "$DIR"
cd "$DIR"

cat > docker-compose.yaml <<EOF
services:
  discord-bot:
    image: ${IMAGE}
    container_name: discord-bot
    restart: unless-stopped
    stop_grace_period: 30s
    env_file:
      - .env
    extra_hosts:
      - host.docker.internal:host-gateway
    mem_limit: 256m
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
EOF

umask 077
{
  aws ssm get-parameters-by-path --path /balisong/prod/discord-bot/ --with-decryption \
    --query "Parameters[*].[Name,Value]" --output text |
    while IFS=$'\t' read -r name value; do echo "$(basename "$name")=$value"; done
  echo "AI_CLIENT_KEY_DISCORD=$(aws ssm get-parameter --name /balisong/prod/AI_CLIENT_KEY_DISCORD --with-decryption --query Parameter.Value --output text)"
} > .env.new
mv .env.new .env
chown -R ec2-user:ec2-user "$DIR"

aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
docker-compose pull
docker-compose up -d
docker-compose run --rm discord-bot node deploy-commands.js

for _ in $(seq 1 30); do
  if docker logs discord-bot 2>&1 | grep -q "Logged in as"; then
    docker logs --tail 5 discord-bot
    docker image prune -f > /dev/null
    exit 0
  fi
  sleep 2
done

echo "Bot did not log in within 60s:"
docker logs --tail 50 discord-bot
exit 1
