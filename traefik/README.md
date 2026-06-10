# Traefik Reverse Proxy - Guía de Uso

## Descripción

Traefik está configurado como reverse proxy para este proyecto, permitiendo:
- **Local**: Acceso a través de dominios locales (api.localhost, dashboard.localhost)
- **Producción**: HTTPS automático con Let's Encrypt, usando dominios reales

## Estructura

```
traefik/
├── traefik.yml          # Config local (HTTP)
├── traefik-prod.yml     # Config producción (HTTPS + Let's Encrypt)
└── README.md            # Este archivo
```

## Ejecución Local

### Requisitos

- Docker y Docker Compose instalados
- (Opcional) Agregar hosts locales en `/etc/hosts` o `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 api.localhost
127.0.0.1 dashboard.localhost
127.0.0.1 traefik.localhost
```

### Iniciar localmente

```bash
docker compose up -d
```

### Acceso local

- **Dashboard**: http://localhost:3000 (acceso directo) o http://dashboard.localhost (vía Traefik)
- **API**: http://localhost:8000 (acceso directo) o http://api.localhost (vía Traefik)
- **Traefik Dashboard**: http://traefik.localhost:8080 o http://localhost:8080

**Nota**: En local, ambos accesos funcionan (directo vía puerto y vía Traefik).

## Despliegue en Producción

### Requisitos

1. Servidor con Docker y Docker Compose
2. Dominio apuntando a la IP del servidor (DNS A records)
3. Puertos 80 y 443 abiertos
4. Email válido para Let's Encrypt

### Configuración

1. Copiar `.env.production.example` a `.env`:
```bash
cp .env.production.example .env
```

2. Actualizar valores en `.env`:
```bash
TRAEFIK_ACME_EMAIL=admin@tudominio.com
TRAEFIK_DASHBOARD_HOST=dashboard.api.tudominio.com
INJURY_API_HOST_INTERNAL=api.tudominio.com
DASHBOARD_HOST_INTERNAL=app.tudominio.com
INJURY_API_URL=https://api.tudominio.com
DASHBOARD_URL=https://app.tudominio.com
VITE_INJURY_API_BASE_URL=https://api.tudominio.com
CORS_ORIGINS=https://app.tudominio.com,https://api.tudominio.com
```

### Iniciar en producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Traefik se encargará automáticamente de:
- ✅ Obtener certificados SSL/TLS de Let's Encrypt
- ✅ Renovar certificados automáticamente
- ✅ Redirigir HTTP → HTTPS
- ✅ Balancear carga entre múltiples instancias (si las hay)

### Acceso en producción

- **Dashboard**: https://app.tudominio.com
- **API**: https://api.tudominio.com
- **Traefik Dashboard**: https://dashboard.api.tudominio.com

## Verificación

### Local - Ver logs
```bash
docker compose logs -f traefik
```

### Producción - Ver certificados
```bash
docker compose exec traefik cat /data/acme.json | jq .
```

## Troubleshooting

### "Connection refused" en Traefik
- Asegurar que la red `world-cup-platform_default` existe
- Verificar que los servicios están en la red correcta

### Let's Encrypt fail en producción
- Verificar que el email en `.env` es válido
- Verificar que el DNS está resolviendo correctamente: `nslookup api.tudominio.com`
- Verificar puertos 80 y 443 abiertos: `curl -i http://tudominio.com`

### Certificados antiguos
```bash
docker compose down
rm -rf traefik-data/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Monitoreo

Traefik proporciona métricas en su dashboard:
- Rutas activas
- Backends disponibles
- Certificados SSL/TLS
- Logs de acceso

Acceder a: `http://traefik.localhost:8080` (local) o `https://dashboard.api.tudominio.com` (prod)
