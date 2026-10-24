# Supabase PostgreSQL certificate authority

`supabase-prod-ca-2021.crt` is Supabase's public root CA certificate, downloaded from:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The connection strings use `sslmode=require` and `sslaccept=strict` with this CA.
Prisma resolves the `sslcert` path relative to the `prisma/` directory.
Next.js includes the certificate in deployed function bundles through
`outputFileTracingIncludes`.

This is a public trust certificate, not a private key or database credential.
