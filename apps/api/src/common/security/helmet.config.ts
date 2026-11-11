import helmet from 'helmet';

/**
 * Konfigurasi HTTP Security Headers menggunakan Helmet.
 * Mengimplementasikan Content-Security-Policy (CSP) ketat, HSTS, frameguard, dan anti-sniffing.
 */
export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"], // Mencegah clickjacking
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 tahun
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
