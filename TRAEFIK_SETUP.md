# Traefik Integration - Guía Completa

## Estado de la Integración ✅

Traefik ha sido integrado exitosamente en el proyecto para proporcionar reverse proxy, con soporte tanto para **desarrollo local** como para **producción con SSL/TLS**.

### Servicios Configurados

- **traefik** (v3.1): Reverse proxy con soporte para Docker provider y ficheros estáticos
- **injury-api**: API FastAPI en puerto 8000 (accesible directamente y a través de Traefik)
- **injury-dashboard**: Dashboard React con SSR en puerto 3000 (accesible directamente y a través de Traefik)

---

## Desarrollo Local (docker-compose.yml)

### Acceso Directo (sin Traefik)
```
Dashboard: http://localhost:3000
API:       http://localhost:8000
Traefik:   http://localhost:8080
```

### Características

- ✅ Todos los servicios funcionan con acceso directo por puerto
- ✅ Traefik levanta exitosamente
- ✅ API es sano (healthcheck pasando)
- ✅ Dashboard muestra correctamente la aplicación React
- ✅ Red Docker compartida entre servicios
- ✅ Rutas estáticas definidas en `traefik/traefik-routes.yml`

### Estructura de Configuración Local

```yaml
Traefik Config:
  traefik/
    ├── traefik.yml         # Config mínima (sin Docker provider)
    └── traefik-routes.yml  # Rutas estáticas (opcional para local)

docker-compose.yml:
  - traefik: con puertos 80, 443, 8080 expuestos
  - injury-api: puerto 8000, sin labels de Traefik
  - injury-dashboard: puerto 3000, sin labels de Traefik
  - Red compartida: world-cup-platform_default
```

---

## Producción (docker-compose.prod.yml)

### Uso en Producción

```bash
# Copiar y actualizar configuración de producción
cp .env.production.example .env

# Editar .env con tus valores
export TRAEFIK_ACME_EMAIL=admin@tudominio.com
export INJURY_API_HOST_INTERNAL=api.tudominio.com
export DASHBOARD_HOST_INTERNAL=app.tudominio.com
# ... (ver .env.production.example)

# Iniciar con configuración de producción
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Características de Producción

- ✅ **HTTPS Automático**: Let's Encrypt se integra automáticamente
- ✅ **Redirección HTTP → HTTPS**: Tráfico automáticamente redirigido a HTTPS
- ✅ **Docker Provider Dinámico**: Descubrimiento automático de servicios
- ✅ **Almacenamiento de Certificados**: Volumen `traefik-data` persiste certificados
- ✅ **API Labels**: Servicios se registran automáticamente en Traefik
- ✅ **Renovación Automática**: Let's Encrypt renueva certificados antes de expirar

### Estructura de Configuración Producción

```yaml
Traefik Config:
  traefik/
    ├── traefik-prod.yml         # Config con Docker provider + ACME
    └── traefik-routes-prod.yml  # Rutas adicionales con SSL/TLS

docker-compose.prod.yml (override):
  - traefik: Docker socket, volumen data, sin --api.insecure
  - injury-api: labels de Traefik para routing
  - injury-dashboard: labels de Traefik para routing
  - volumen traefik-data: para acme.json y certificados
```

---

## Archivos de Configuración

### `.env.example` (Desarrollo Local)
```bash
TRAEFIK_HTTP_PORT=80
TRAEFIK_HTTPS_PORT=443
TRAEFIK_DASHBOARD_PORT=8080
TRAEFIK_DASHBOARD_HOST=traefik.localhost
INJURY_API_HOST_INTERNAL=api.localhost
DASHBOARD_HOST_INTERNAL=dashboard.localhost
VITE_INJURY_API_BASE_URL=http://localhost:8000
```

### `.env.production.example` (Producción)
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

---

## Casos de Uso

### Local: Desarrollo Rápido
```bash
docker compose up -d
# Acceder a http://localhost:3000 (dashboard)
# Acceder a http://localhost:8000 (api)
```

### Local: Con nombres de dominio
```bash
# Agregar a /etc/hosts (Linux/Mac) o C:\Windows\System32\drivers\etc\hosts (Windows):
127.0.0.1 api.localhost
127.0.0.1 dashboard.localhost
127.0.0.1 traefik.localhost

# Acceder a http://api.localhost (a través de Traefik)
# Acceder a http://dashboard.localhost (a través de Traefik)
# Acceder a http://traefik.localhost:8080 (Traefik Dashboard)
```

### Producción: Despliegue Automático
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Acceder a https://api.tudominio.com (automáticamente con SSL)
# Acceder a https://app.tudominio.com (automáticamente con SSL)
# Let's Encrypt se encarga de certificados automáticamente
```

---

## Monitoreo

### Ver Logs de Traefik
```bash
# Desarrollo
docker compose logs -f traefik

# Producción
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f traefik
```

### Ver Certificados en Producción
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec traefik cat /data/acme.json | jq .
```

### Verificar Rutas Activas
```bash
curl -s http://localhost:8080/api/http/routers | jq .
```

---

## Troubleshooting

### Traefik no responde en puerto 8080
- Esto es normal en desarrollo local sin hostname específico
- Usar acceso directo: `http://localhost:3000`, `http://localhost:8000`
- Traefik actúa como reverse proxy pero puedes acceder directamente

### "Connection refused" en Traefik (producción)
- Verificar que Docker socket está montado: `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -a`
- Ver logs: `docker compose logs traefik`

### Let's Encrypt falla en producción
1. Verificar email es válido en `.env`
2. Verificar DNS resuelve correctamente: `nslookup api.tudominio.com`
3. Verificar puertos 80 y 443 abiertos: `curl -i http://tudominio.com`
4. Revisar logs de Traefik: `docker compose logs traefik`

### Certificados no se renuevan
- Traefik los renueva automáticamente
- Verificar volumen `traefik-data` existe: `docker volume ls`
- Ver archivo acme.json: `docker compose exec traefik cat /data/acme.json`

---

## Próximos Pasos

1. **Desarrollo Local**: Acceder a http://localhost:3000
2. **Testing**: Verificar API con `curl http://localhost:8000/health`
3. **Producción**: Configurar `.env` con tu dominio y ejecutar override compose
4. **Monitoreo**: Usar Traefik Dashboard para ver rutas y servicios activos
5. **CI/CD**: Integrar con GitHub Actions o similar para despliegues automáticos

---

## Referencia de Archivos

```
world-cup-platform/
├── docker-compose.yml                    # Config base con Traefik + servicios
├── docker-compose.prod.yml              # Override para producción
├── .env.example                          # Variables para desarrollo local
├── .env.production.example               # Variables para producción
└── traefik/
    ├── traefik.yml                       # Config local (rutas estáticas)
    ├── traefik-prod.yml                  # Config producción (Docker provider)
    ├── traefik-routes.yml                # Rutas locales (HTML simplificado)
    ├── traefik-routes-prod.yml           # Rutas producción (con SSL/TLS)
    └── README.md                         # Documentación detallada
```

---

## Status Actual ✅

- [x] Traefik integrado en docker-compose.yml
- [x] Configuración local funcional (sin Docker provider)
- [x] Configuración producción con Let's Encrypt
- [x] Servicios levantando correctamente
- [x] API accesible y sana
- [x] Dashboard funcionando correctamente
- [x] Documentación completa
- [x] Archivos de ejemplo (.env) preparados

**Proyecto listo para desarrollo local y deployments en producción.**
