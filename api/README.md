# API FaunaSantiago (preparada, no desplegada)

La web pública continúa en GitHub Pages. El Worker de IA se mantiene separado del sitio.

## Despliegue seguro
El Worker actual de Cloudflare llamado `fauna-santiago` muestra el sitio web. **No reemplazarlo sin revisar primero su configuración de GitHub Builds**.

1. Crear un Worker separado llamado `fauna-santiago-api` (puede usar la misma cuenta Cloudflare).
2. Desde la raíz del repositorio, desplegar con `npx wrangler deploy -c api/wrangler.toml` usando una sesión autorizada.
3. En Settings > Variables and Secrets agregar **OPENAI_API_KEY** como Secret (nunca en GitHub ni en HTML).
4. Comprobar `GET https://fauna-santiago-api.<subdominio>.workers.dev/health`.
5. Integrar la URL definitiva en el frontend, una vez probada.

## Contrato de API
`POST /identify` con JSON `{"images":["data:image/jpeg;base64,..."],"group":"Reptiles","location":"Santiago del Estero"}`.
De 1 a 3 fotos JPEG/PNG/WebP, hasta 4 MB por imagen.
El servicio entrega candidatos **preliminares**, no identificación científica verificada.
La consulta de fuentes SIB/GBIF/iNaturalist, la limitación de abuso y el control de presupuesto son tareas pendientes antes de habilitar uso público.

**Seguridad:** no abrir el endpoint públicamente sin límites de solicitudes y gastos. CORS no es un mecanismo suficiente de autenticación o control de abuso.
