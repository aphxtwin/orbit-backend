# Orbit Backend - Deployment Guide

This guide explains how to deploy the Orbit Backend with automatic SSL certificate generation using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Domain name configured with Cloudflare DNS
- Cloudflare API token with DNS edit permissions

## Environment Setup

1. **Create a `.env` file** in the project root with the following variables:

```env
# Domain Configuration
DOMAIN=messaging.bici-dev.com

# Cloudflare API (for SSL certificate generation)
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
LETSENCRYPT_EMAIL=your_email@domain.com

# Database Configuration
MONGODB_URI=mongodb://username:password@host:port/database
REDIS_PASSWORD=your_redis_password_here

# Application Configuration
NODE_ENV=production
```

2. **Create secrets directory**:
```bash
mkdir -p secrets
```

## Deployment Steps

### Step 1: Initial Deployment (HTTP Only)

Start all services with HTTP-only nginx configuration:

```bash
docker compose up -d
```

This will start:
- ✅ Nginx (HTTP-only, no SSL errors)
- ✅ Redis database
- ✅ Backend application
- ✅ Certbot (generates SSL certificates)

### Step 2: Monitor Certificate Generation

Watch certbot logs to see when SSL certificates are generated:

```bash
docker compose logs -f orbit-backend-certbot
```

**Wait for this message:**
```
Certificates generated successfully. You can now switch nginx to use the full SSL config and restart the container.
```

### Step 3: Switch to HTTPS Configuration

1. **Edit `docker-compose.yml`** - Change line 9 from:
   ```yaml
   - ./nginx/nginx-http-only.conf:/etc/nginx/nginx.conf:ro
   ```

   To:
   ```yaml
   - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
   ```

2. **Restart nginx** to use the SSL configuration:
   ```bash
   docker compose restart nginx
   ```

### Step 4: Verify Deployment

Check that all services are running:
```bash
docker compose ps
```

Test the endpoints:
- HTTP: `http://your-domain.com/health`
- HTTPS: `https://your-domain.com/health`

## Service Architecture

| Service | Container Name | Port | Purpose |
|---------|----------------|------|---------|
| Nginx | orbit-backend-proxy | 80, 443 | Reverse proxy & SSL termination |
| Backend | orbit-backend-backend | 8080 | Node.js application server |
| Redis | orbit-backend-redis | 6379 | Session & caching store |
| Certbot | orbit-backend-certbot | - | SSL certificate generation |

## Configuration Files

- `docker-compose.yml` - Service orchestration
- `nginx/nginx-http-only.conf` - Initial HTTP-only config
- `nginx/nginx.conf` - Full HTTPS configuration
- `.env` - Environment variables (create this)

## Troubleshooting

### Backend fails to start
```
MongoDB connection error: The uri parameter to openUri() must be a string, got "undefined"
```
**Solution:** Check that `MONGODB_URI` is set in your `.env` file.

### Nginx SSL errors
```
nginx: [emerg] cannot load certificate
```
**Solution:** Make sure you've completed Step 3 (switching to HTTPS config) only AFTER certbot has generated certificates.

### Certbot fails
```
An unexpected error occurred: EOFError
```
**Solution:** Verify your `CLOUDFLARE_API_TOKEN` has DNS edit permissions and is correctly set in `.env`.

## Certificate Renewal

Certificates auto-renew. To manually renew:
```bash
docker compose run --rm certbot certbot renew
docker compose restart nginx
```

## Logs

View logs for debugging:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f orbit-backend-backend
docker compose logs -f orbit-backend-proxy
docker compose logs -f orbit-backend-certbot
```

## Production Notes

- Certificates are stored in the `letsencrypt` Docker volume
- Application logs are stored in `./logs/` directories
- Redis data persists in the `redis_data` Docker volume
- The setup uses Cloudflare DNS challenge for wildcard SSL certificates

---

**Important:** Always complete the certificate generation (Step 2) before switching to HTTPS configuration (Step 3).
