# Lambda — Google Isochrones API

## Overview

Backend for the project. Main job: receive requests from frontend, call Google Isochrones API, return results.

**2 code files:**
- `handler.js` — runs on AWS Lambda (Amazon's cloud server)
- `local.js` — runs on your machine for testing

---

## handler.js — Main logic

This file handles every incoming request. It does 4 things:

### 1. Validate input

The `validate(body)` function checks user input:
- `latitude`: must be a number, -90 to 90
- `longitude`: must be a number, -180 to 180
- `travelMode`: must be one of — `DRIVE` (car), `WALK` (walking), `BICYCLE` (biking)
- `travelDuration`: must be an integer, 60 to 14400 seconds

If anything is wrong → return error immediately, don't call Google.

### 2. Call Google Isochrones API

The `computeIsochrone(dto)` function sends a request to Google:
- Gets the API key from environment variable (never hardcoded)
- Sends location, travel time, and travel mode
- Google returns a polygon — the area you can reach within that time
- If Google fails → return error to user

### 3. Format responses

The `json(status, body)` function builds a standard HTTP response:
- Always includes CORS headers (so frontend can call from a different domain)
- JSON format
- Every response has an HTTP `statusCode`

### 4. Route requests

The `handler(event)` function is the **front door** — every request goes through it:

| Request | Returns |
|---------|---------|
| `OPTIONS /...` | 204 — CORS preflight |
| `GET /health` | 200 — "server is alive" |
| `POST /isochrones` | 200 + polygon result |
| Anything else | 404 — "not found" |

Error codes:
- **400** — bad input (validation failed)
- **204** — no reachable area found (time too short, location too remote, etc.)
- **502** — Google API returned an error
- **500** — server error (missing API key, unexpected crash, etc.)

---

## local.js — Local dev server

This file is **dev only** (never deployed to AWS).

It creates a tiny HTTP server on port **3001**:

```
Your machine → HTTP request → local.js → handler.js → Google API → response back
```

### How it works

1. Listens for HTTP requests from the frontend
2. Converts the HTTP request into Lambda event format
3. Calls `handler(event)` — exactly like AWS does
4. Sends the result back to the frontend

This lets you test the backend on your laptop without deploying to AWS.

The frontend calls `http://localhost:3001/api/isochrones`, and local.js strips the `/api` prefix before processing.

---

## Commands

```bash
# Start local dev server
npm run dev

# Package for AWS deployment
npm run bundle   # → creates lambda.zip
```

After `npm run dev`, the server is ready at http://localhost:3001.

## Deploy to AWS

```bash
npm run bundle  # → lambda.zip (~2KB)

# Create Lambda function
aws lambda create-function \
  --function-name google-isochrones \
  --runtime nodejs22.x \
  --architectures arm64 \
  --handler handler.handler \
  --memory-size 128 \
  --timeout 10 \
  --environment "Variables={GOOGLE_MAPS_API_KEY=...}" \
  --role arn:aws:iam::ACCOUNT:role/lambda-basic \
  --zip-file fileb://lambda.zip

# Enable Function URL (allow public access)
aws lambda create-function-url-config \
  --function-name google-isochrones \
  --auth-type NONE
```
