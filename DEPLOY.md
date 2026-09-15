# Deploying Crispy to tyler@crispygoat.com

One-time box setup, then `git push origin main` does the rest.

## 1. Box prerequisites

The server (`tyler@crispygoat.com`, same box as `git.crispygoat.com`) needs:

- Node 20.x (`fnm install 20` or `nvm install 20`)
- PM2 (`npm i -g pm2`)
- nginx with the vhost from `docs/nginx-crispygoat.conf`
- A self-hosted GitHub Actions runner registered to this repo with label `self-hosted`
- Let's Encrypt cert at `/etc/letsencrypt/live/crispygoat.com/`

## 2. Install site

```bash
ssh tyler@crispygoat.com
sudo mkdir -p /home/tyler/crispy
sudo chown tyler:tyler /home/tyler/crispy
cd /home/tyler/crispy

# first deploy — copy dist/ + server/ + package.json up manually, then:
npm ci
npm --prefix server ci

cp server/.env.example server/.env
$EDITOR server/.env      # set JWT_SECRET, ADMIN_PASSWORD, STRIPE_*, etc.

pm2 start server/src/index.js --name crispy-api
pm2 save
pm2 startup               # follow the printed sudo line so it survives reboot
```

## 3. nginx

```bash
sudo cp docs/nginx-crispygoat.conf /etc/nginx/sites-available/crispygoat
sudo ln -sf /etc/nginx/sites-available/crispygoat /etc/nginx/sites-enabled/crispygoat
sudo nginx -t && sudo systemctl reload nginx
```

## 4. GitHub Actions runner

If the box already has a runner registered to `dzinesco/crispy` with the
`self-hosted` label, push to `main` and you're done. Otherwise:

```bash
# on the box
mkdir actions-runner && cd actions-runner
curl -O -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz
./config.sh --url https://github.com/dzinesco/crispy --token <TOKEN> --labels self-hosted
sudo ./svc.sh install tyler
sudo ./svc.sh start
```

## 5. GitHub repo secrets

In **Settings → Secrets and variables → Actions**, add:

- `DEPLOY_SSH_KEY` — private half of an `ed25519` key whose public half is in
  `~tyler/.ssh/authorized_keys` on the box. Generate with
  `ssh-keygen -t ed25519 -C crispy-deploy -f ~/.ssh/crispy_deploy -N ""`.

## 6. First push

```bash
cd /Users/tylermartinez/dev/crispygoat
git add -A
git commit -m "feat: initial React + API scaffold"
git push origin main
```

Watch the run at https://github.com/dzinesco/crispy/actions.

## Daily deploys

```bash
git add -A
git commit -m "..."
git push origin main
```

That's it — the runner builds, scps `dist/` + `server/` + `package.json` to
`/home/tyler/crispy/`, and runs `pm2 restart crispy-api`.

## Rolling back

```bash
ssh tyler@crispygoat.com
cd /home/tyler/crispy
pm2 restart crispy-api
# if the build is broken:
git -C /home/tyler/crispy checkout HEAD~1 -- dist server package.json
pm2 restart crispy-api
```

## Data

The SQLite file lives at `/home/tyler/crispy/server/data/crispy.db`. Back it
up with:

```bash
ssh tyler@crispygoat.com 'cp /home/tyler/crispy/server/data/crispy.db /tmp/crispy-$(date +%F).db'
scp tyler@crispygoat.com:/tmp/crispy-*.db ./backups/
```
