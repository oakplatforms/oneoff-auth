# oneoff-auth

oneoff-auth contains authentication and authorization Lambda functions for the Oneoff platform. This repo is designed for modular, serverless deployment of auth-related services (e.g., custom authorizer, guest token, and future auth lambdas).

## Structure
- `lambdas/` — Lambda handler source files
- `serverless.yml` — Serverless deployment configs for dev (service name: oneoff-auth)
- `.github/workflows/` — GitHub Actions for CI/CD

## Deployment
See the workflows in `.github/workflows/` and the serverless YAML files for environment variable and deployment details.
