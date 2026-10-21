#!/bin/bash
# Runs on the backend EC2 instance (as root, via SSM) to deploy the bot as its
# own compose project. Writes everything it needs each time, so a rebuilt
# instance is fully set up again by the next deploy.
# Usage: remote-deploy.sh <image:tag>
set -euo pipefail

IMAGE="$1"
REGISTRY="${IMAGE%%/*}"
DIR=/home/ec2-user/discord-bot
BACKUP_BUCKET=balisong-flipping-center-discord-bot-backups-prod
export AWS_DEFAULT_REGION=us-east-1

mkdir -p "$DIR/data"
cd "$DIR"

# A rebuilt instance has no database yet: restore the latest backup. Only a
# missing backup (first deploy ever) is fine to start empty from — any other
# error fails the deploy, so a permissions problem can't start an empty
# database that the nightly backup would then overwrite the real one with.
if [ ! -f data/bot.db ]; then
  if aws s3api head-object --bucket "$BACKUP_BUCKET" --key latest.db > /dev/null 2> head-object.err; then
    aws s3 cp "s3://$BACKUP_BUCKET/latest.db" data/bot.db
    echo "Restored the database from the latest backup"
  elif grep -q "Not Found" head-object.err; then
    echo "No backup yet — starting with an empty database"
  else
    cat head-object.err
    exit 1
  fi
  rm -f head-object.err
fi

cat > backup.sh <<EOF
#!/bin/bash
set -euo pipefail
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}
cd ${DIR}
docker exec discord-bot node scripts/backup-db.js
aws s3 cp data/backup.db "s3://${BACKUP_BUCKET}/daily/\$(date -u +%F).db"
aws s3 cp data/backup.db "s3://${BACKUP_BUCKET}/latest.db"
EOF
chmod +x backup.sh

cat > /etc/systemd/system/discord-bot-backup.service <<EOF
[Unit]
Description=Back up the Discord bot database to S3

[Service]
Type=oneshot
ExecStart=${DIR}/backup.sh
EOF

cat > /etc/systemd/system/discord-bot-backup.timer <<EOF
[Unit]
Description=Nightly Discord bot database backup

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now discord-bot-backup.timer

cat > docker-compose.yaml <<EOF
services:
  discord-bot:
    image: ${IMAGE}
    container_name: discord-bot
    restart: unless-stopped
    stop_grace_period: 30s
    env_file:
      - .env
    volumes:
      - ./data:/data
    extra_hosts:
      - host.docker.internal:host-gateway
    mem_limit: 256m
    logging:
      driver: awslogs
      options:
        awslogs-region: ${AWS_DEFAULT_REGION}
        awslogs-group: /balisong/prod/discord-bot
        mode: non-blocking
        max-buffer-size: 4m
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
    ./backup.sh
    docker image prune -f > /dev/null
    exit 0
  fi
  sleep 2
done

echo "Bot did not log in within 60s:"
docker logs --tail 50 discord-bot
exit 1
