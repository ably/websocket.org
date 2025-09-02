---
title: Kubernetes Ingress WebSocket Configuration
description:
  Configure NGINX, Traefik, and HAProxy Ingress controllers for WebSocket
  applications in Kubernetes with service mesh integration
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
publishedDate: 2025-09-01
updatedDate: 2025-09-01
category: infrastructure
tags:
  [
    kubernetes,
    ingress,
    websocket,
    nginx-ingress,
    traefik,
    haproxy,
    service-mesh,
    istio,
  ]
seo:
  title: 'Kubernetes WebSocket Ingress: NGINX, Traefik & HAProxy Configuration'
  description:
    'Complete guide to configuring Kubernetes Ingress controllers for WebSocket
    applications including NGINX, Traefik, HAProxy, and service mesh
    integration.'
  keywords:
    [
      'kubernetes websocket',
      'ingress websocket',
      'nginx ingress websocket',
      'traefik websocket',
      'haproxy ingress',
      'istio websocket',
      'k8s websocket',
    ]
---

Kubernetes Ingress controllers can handle WebSocket connections with proper
configuration. This guide covers the most popular ingress controllers: NGINX,
Traefik, and HAProxy, plus service mesh integration with Istio and Linkerd.

## Quick Start: NGINX Ingress

The most common configuration for WebSocket support in Kubernetes:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-connect-timeout: '3600'
spec:
  ingressClassName: nginx
  rules:
    - host: ws.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: websocket-service
                port:
                  number: 8080
```

## NGINX Ingress Controller

### Installation

```bash
# Using Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.config.proxy-read-timeout="3600" \
  --set controller.config.proxy-send-timeout="3600" \
  --set controller.config.use-proxy-protocol="false"

# Or using kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

### WebSocket Configuration

Complete NGINX Ingress configuration for WebSocket:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-ingress
  namespace: default
  annotations:
    # WebSocket specific timeouts
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-connect-timeout: '3600'

    # Buffering settings
    nginx.ingress.kubernetes.io/proxy-buffering: 'off'
    nginx.ingress.kubernetes.io/proxy-request-buffering: 'off'

    # WebSocket headers (usually auto-detected)
    nginx.ingress.kubernetes.io/upstream-hash-by: '$remote_addr'

    # SSL configuration
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/force-ssl-redirect: 'true'

    # Backend protocol
    nginx.ingress.kubernetes.io/backend-protocol: 'HTTP'

    # Session affinity for WebSocket
    nginx.ingress.kubernetes.io/affinity: 'cookie'
    nginx.ingress.kubernetes.io/affinity-mode: 'persistent'
    nginx.ingress.kubernetes.io/session-cookie-name: 'ws-server'
    nginx.ingress.kubernetes.io/session-cookie-expires: '86400'
    nginx.ingress.kubernetes.io/session-cookie-max-age: '86400'
    nginx.ingress.kubernetes.io/session-cookie-path: '/'

    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: '10'
    nginx.ingress.kubernetes.io/limit-connections: '100'

    # CORS settings
    nginx.ingress.kubernetes.io/enable-cors: 'true'
    nginx.ingress.kubernetes.io/cors-allow-origin: '*'
    nginx.ingress.kubernetes.io/cors-allow-methods:
      'GET, PUT, POST, DELETE, PATCH, OPTIONS'
    nginx.ingress.kubernetes.io/cors-allow-headers: 'DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization'
    nginx.ingress.kubernetes.io/cors-max-age: '1728000'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ws.example.com
      secretName: websocket-tls
  rules:
    - host: ws.example.com
      http:
        paths:
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: websocket-service
                port:
                  number: 8080
```

### ConfigMap for Global Settings

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
data:
  # Global WebSocket settings
  proxy-read-timeout: '3600'
  proxy-send-timeout: '3600'
  proxy-connect-timeout: '30'

  # Buffer settings
  proxy-buffering: 'off'
  proxy-buffer-size: '4k'
  proxy-buffers: '8 4k'
  proxy-busy-buffers-size: '8k'
  proxy-max-temp-file-size: '1024m'

  # Keepalive settings
  upstream-keepalive-connections: '320'
  upstream-keepalive-requests: '10000'
  upstream-keepalive-timeout: '60'

  # Worker settings
  worker-processes: 'auto'
  worker-connections: '10240'

  # Rate limiting
  limit-req-status-code: '429'
  limit-conn-status-code: '429'

  # Logging
  log-format-upstream:
    '$remote_addr - $remote_user [$time_local] "$request" $status
    $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"
    $proxy_upstream_name $upstream_addr $upstream_response_length
    $upstream_response_time $upstream_status $req_id'

  # SSL settings
  ssl-protocols: 'TLSv1.2 TLSv1.3'
  ssl-ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
  ssl-prefer-server-ciphers: 'true'

  # HTTP/2 settings
  use-http2: 'true'
  http2-max-field-size: '16k'
  http2-max-header-size: '32k'
```

### Custom Server Snippets

For advanced configuration:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-ingress
  annotations:
    nginx.ingress.kubernetes.io/server-snippet: |
      location ~* /ws {
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket specific
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
      }
```

## Traefik Ingress Controller

### Installation

```bash
# Using Helm
helm repo add traefik https://helm.traefik.io/traefik
helm repo update

helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set ports.websocket.port=8080 \
  --set ports.websocket.expose=true \
  --set ports.websocket.protocol=TCP
```

### Traefik IngressRoute for WebSocket

```yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: websocket-ingressroute
  namespace: default
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`ws.example.com`)
      kind: Rule
      services:
        - name: websocket-service
          port: 8080
          # WebSocket is auto-detected by Traefik
      middlewares:
        - name: websocket-headers
  tls:
    secretName: websocket-tls
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: websocket-headers
  namespace: default
spec:
  headers:
    customRequestHeaders:
      X-Forwarded-Proto: https
    customResponseHeaders:
      X-Frame-Options: SAMEORIGIN
      X-Content-Type-Options: nosniff
    sslRedirect: true
    sslForceHost: true
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: websocket-ratelimit
  namespace: default
spec:
  rateLimit:
    average: 100
    period: 1m
    burst: 50
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: websocket-circuit-breaker
  namespace: default
spec:
  circuitBreaker:
    expression: ResponseCodeRatio(500, 600, 0, 600) > 0.30
```

### Traefik Sticky Sessions

```yaml
apiVersion: traefik.containo.us/v1alpha1
kind: ServersTransport
metadata:
  name: websocket-transport
  namespace: default
spec:
  serverName: websocket-backend
  insecureSkipVerify: true
  maxIdleConnsPerHost: 100
  forwardingTimeouts:
    dialTimeout: 30s
    responseHeaderTimeout: 3600s
    idleConnTimeout: 3600s
---
apiVersion: traefik.containo.us/v1alpha1
kind: TraefikService
metadata:
  name: websocket-sticky
  namespace: default
spec:
  weighted:
    sticky:
      cookie:
        name: websocket_server
        secure: true
        httpOnly: true
        sameSite: strict
    services:
      - name: websocket-service
        port: 8080
        weight: 1
```

## HAProxy Ingress Controller

### Installation

```bash
# Using Helm
helm repo add haproxytech https://haproxytech.github.io/helm-charts
helm repo update

helm install haproxy-ingress haproxytech/kubernetes-ingress \
  --namespace haproxy-ingress \
  --create-namespace \
  --set controller.config.timeout-client=3600s \
  --set controller.config.timeout-server=3600s \
  --set controller.config.timeout-connect=30s \
  --set controller.config.timeout-tunnel=3600s
```

### HAProxy WebSocket Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-ingress
  namespace: default
  annotations:
    haproxy.org/timeout-tunnel: '3600s'
    haproxy.org/load-balance: 'leastconn'
    haproxy.org/cookie-persistence: 'ws-server'
    haproxy.org/check: 'true'
    haproxy.org/check-http: '/health'
    haproxy.org/forwarded-for: 'true'
spec:
  ingressClassName: haproxy
  rules:
    - host: ws.example.com
      http:
        paths:
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: websocket-service
                port:
                  number: 8080
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: haproxy-configmap
  namespace: haproxy-ingress
data:
  timeout-connect: '30s'
  timeout-client: '3600s'
  timeout-server: '3600s'
  timeout-tunnel: '3600s'
  timeout-http-request: '30s'
  timeout-http-keep-alive: '60s'
  timeout-queue: '30s'

  # WebSocket detection
  option-http-server-close: 'false'
  option-forwardfor: 'true'

  # Load balancing
  balance-algorithm: 'leastconn'

  # Health checks
  check-interval: '10s'
  check-timeout: '5s'
  check-rise: '2'
  check-fall: '3'

  # Session persistence
  cookie: 'SERVERID insert indirect nocache'

  # Rate limiting
  rate-limit-sessions: '100'
  rate-limit-period: '10s'
```

### HAProxy Advanced Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: haproxy-backend-config
  namespace: default
data:
  websocket-backend: |
    # Backend configuration for WebSocket
    backend websocket_backend
        mode http
        balance leastconn
        
        # WebSocket support
        option http-server-close
        option forwardfor
        
        # Timeouts for long-lived connections
        timeout server 3600s
        timeout tunnel 3600s
        timeout connect 30s
        
        # Health checks
        option httpchk GET /health HTTP/1.1\r\nHost:\ websocket
        http-check expect status 200
        
        # Sticky sessions
        cookie SERVERID insert indirect nocache
        
        # Servers with WebSocket support
        server ws1 websocket-pod-1:8080 check cookie ws1
        server ws2 websocket-pod-2:8080 check cookie ws2
        server ws3 websocket-pod-3:8080 check cookie ws3
        
        # Connection limits
        maxconn 10000
        
        # Queue settings
        timeout queue 30s
        option redispatch
        retries 3
```

## Service Mesh Integration

### Istio Configuration

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: websocket-gateway
  namespace: default
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: websocket-tls
      hosts:
        - ws.example.com
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: websocket-vs
  namespace: default
spec:
  hosts:
    - ws.example.com
  gateways:
    - websocket-gateway
  http:
    - match:
        - uri:
            prefix: /ws
      route:
        - destination:
            host: websocket-service
            port:
              number: 8080
      timeout: 0s # Disable timeout for WebSocket
      websocketUpgrade: true # Enable WebSocket upgrade
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: websocket-dr
  namespace: default
spec:
  host: websocket-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 100
        maxRequestsPerConnection: 2
        h2UpgradePolicy: UPGRADE # Automatically upgrade to HTTP/2
    loadBalancer:
      simple: ROUND_ROBIN
      consistentHash:
        httpCookie:
          name: 'session-affinity'
          ttl: 3600s
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  namespace: default
  labels:
    app: websocket
spec:
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
      name: http-websocket # Important: name must include 'http' for Istio
  selector:
    app: websocket
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
```

### Linkerd Configuration

```yaml
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: websocket-authz
  namespace: default
spec:
  server:
    selector:
      matchLabels:
        app: websocket
  client:
    meshTLS:
      identities:
        - 'cluster.local/ns/default/sa/websocket-client'
---
apiVersion: policy.linkerd.io/v1beta1
kind: Server
metadata:
  name: websocket-server
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: websocket
  port: 8080
  proxyProtocol: 'HTTP/1.1' # WebSocket requires HTTP/1.1
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  namespace: default
  annotations:
    linkerd.io/inject: enabled
    config.linkerd.io/proxy-cpu-request: '100m'
    config.linkerd.io/proxy-memory-request: '20Mi'
    config.linkerd.io/proxy-cpu-limit: '1'
    config.linkerd.io/proxy-memory-limit: '250Mi'
spec:
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
  selector:
    app: websocket
```

## WebSocket Service and Deployment

### Complete WebSocket Application Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-app
  namespace: default
  labels:
    app: websocket
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket
  template:
    metadata:
      labels:
        app: websocket
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '9090'
        prometheus.io/path: '/metrics'
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - websocket
                topologyKey: kubernetes.io/hostname
      containers:
        - name: websocket-server
          image: websocket-app:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
              name: websocket
              protocol: TCP
            - containerPort: 9090
              name: metrics
              protocol: TCP
          env:
            - name: PORT
              value: '8080'
            - name: MAX_CONNECTIONS
              value: '10000'
            - name: PING_INTERVAL
              value: '30000'
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '1000m'
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            successThreshold: 1
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 15']
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  namespace: default
  labels:
    app: websocket
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
      name: websocket
    - port: 9090
      targetPort: 9090
      protocol: TCP
      name: metrics
  selector:
    app: websocket
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800 # 3 hours
```

## Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: websocket_connections
        target:
          type: AverageValue
          averageValue: '1000' # Scale when avg connections > 1000
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
        - type: Pods
          value: 2
          periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
        - type: Pods
          value: 5
          periodSeconds: 60
      selectPolicy: Max
```

## Monitoring and Observability

### Prometheus ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: websocket-metrics
  namespace: default
spec:
  selector:
    matchLabels:
      app: websocket
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: websocket-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "WebSocket Metrics",
        "panels": [
          {
            "title": "Active Connections",
            "targets": [
              {
                "expr": "sum(websocket_connections_active)"
              }
            ]
          },
          {
            "title": "Connection Rate",
            "targets": [
              {
                "expr": "rate(websocket_connections_total[5m])"
              }
            ]
          },
          {
            "title": "Message Rate",
            "targets": [
              {
                "expr": "rate(websocket_messages_total[5m])"
              }
            ]
          },
          {
            "title": "Error Rate",
            "targets": [
              {
                "expr": "rate(websocket_errors_total[5m])"
              }
            ]
          }
        ]
      }
    }
```

### Custom Metrics for HPA

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adapter-config
  namespace: custom-metrics
data:
  config.yaml: |
    rules:
    - seriesQuery: 'websocket_connections_active{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        matches: "^websocket_connections_active"
        as: "websocket_connections"
      metricsQuery: 'avg_over_time(websocket_connections_active{<<.LabelMatchers>>}[1m])'
```

## Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: websocket-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: websocket
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
        - namespaceSelector:
            matchLabels:
              name: istio-system
      ports:
        - protocol: TCP
          port: 8080
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 9090
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 53 # DNS
        - protocol: UDP
          port: 53 # DNS
    - to:
        - podSelector:
            matchLabels:
              app: redis # If using Redis for pub/sub
      ports:
        - protocol: TCP
          port: 6379
```

## TLS/SSL Configuration

### Certificate Management with cert-manager

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: websocket-tls
  namespace: default
spec:
  secretName: websocket-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: ws.example.com
  dnsNames:
    - ws.example.com
    - '*.ws.example.com'
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

## Testing WebSocket Connections

### Test Pod for WebSocket

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: websocket-test
  namespace: default
spec:
  containers:
  - name: wscat
    image: node:alpine
    command: ["/bin/sh"]
    args: ["-c", "npm install -g wscat && sleep infinity"]
---
# Test from within cluster
kubectl exec -it websocket-test -- wscat -c ws://websocket-service:8080/ws

# Test through ingress
wscat -c wss://ws.example.com/ws
```

### Load Testing with K6

```javascript
// k6-websocket-test.js
import { check } from 'k6';
import ws from 'k6/ws';

export let options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp up
    { duration: '1m', target: 100 }, // Stay at 100 connections
    { duration: '30s', target: 0 }, // Ramp down
  ],
};

export default function () {
  const url = 'wss://ws.example.com/ws';
  const params = { tags: { my_tag: 'websocket' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      console.log('Connected');
      socket.send('Hello Server!');
    });

    socket.on('message', (data) => {
      console.log('Message received: ', data);
    });

    socket.on('close', () => {
      console.log('Disconnected');
    });

    socket.on('error', (e) => {
      console.log('Error: ', e.error());
    });

    socket.setTimeout(() => {
      socket.close();
    }, 10000);
  });

  check(res, { 'Connected successfully': (r) => r && r.status === 101 });
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Connection immediately closes**

```bash
# Check ingress logs
kubectl logs -n ingress-nginx deployment/nginx-ingress-controller

# Verify annotations
kubectl describe ingress websocket-ingress

# Test without TLS
kubectl port-forward service/websocket-service 8080:8080
wscat -c ws://localhost:8080/ws
```

1. **502 Bad Gateway**

```bash
# Check service endpoints
kubectl get endpoints websocket-service

# Verify pods are running
kubectl get pods -l app=websocket

# Check pod logs
kubectl logs -l app=websocket --tail=50
```

1. **Session affinity not working**

```bash
# Verify session affinity configuration
kubectl get service websocket-service -o yaml | grep -A 5 sessionAffinity

# Check ingress cookie settings
kubectl get ingress websocket-ingress -o yaml | grep -i cookie
```

1. **High latency or timeouts**

```bash
# Check resource usage
kubectl top pods -l app=websocket

# Review HPA status
kubectl get hpa websocket-hpa

# Check network policies
kubectl get networkpolicy -o wide
```

### Debug Commands

```bash
# Enable debug logging for NGINX Ingress
kubectl -n ingress-nginx edit configmap nginx-configuration
# Add: error-log-level: debug

# Capture traffic with tcpdump
kubectl exec -it websocket-pod -- tcpdump -i any -w /tmp/capture.pcap port 8080

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup websocket-service

# Check ingress controller version
kubectl -n ingress-nginx get deployment nginx-ingress-controller -o jsonpath='{.spec.template.spec.containers[0].image}'
```

## Best Practices

1. **Use appropriate ingress controller**: NGINX for simplicity, Traefik for
   auto-detection
2. **Configure session affinity**: Essential for stateful WebSocket connections
3. **Set proper timeouts**: Long timeouts for WebSocket connections
4. **Implement health checks**: Ensure pods are ready before receiving traffic
5. **Use HPA carefully**: WebSocket connections are stateful, scale gradually
6. **Monitor connection metrics**: Track active connections and resource usage
7. **Implement graceful shutdown**: Allow time for connections to close
8. **Use network policies**: Restrict traffic to necessary ports
9. **Enable TLS/SSL**: Always use WSS in production
10. **Test failover scenarios**: Verify behavior during pod restarts

## Additional Resources

- [NGINX Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [HAProxy Ingress Documentation](https://haproxy-ingress.github.io/)
- [Istio WebSocket Support](https://istio.io/latest/docs/ops/configuration/traffic-management/protocol-selection/)
- [Kubernetes Networking](https://kubernetes.io/docs/concepts/services-networking/)

---

_This guide is maintained by
[Matthew O'Riordan](https://twitter.com/mattyoriordan), Co-founder & CEO of
[Ably](https://ably.com), the real-time data platform. For corrections or
suggestions, please
[open an issue](https://github.com/websockets/websocket.org/issues)._
