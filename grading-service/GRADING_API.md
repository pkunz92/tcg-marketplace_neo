# Grading Service API Contract

The grading service is a standalone FastAPI microservice that accepts a card photo URL,
runs the ML recognition + condition grading pipeline, and returns a structured result.

The backend ([TCG-38](/TCG/issues/TCG-38)) calls this service after uploading the card
photo to S3.

---

## Base URL

| Environment | URL                           |
|-------------|-------------------------------|
| Local       | `http://localhost:8001`       |
| Docker      | `http://grading-service:8001` |

---

## Authentication

All mutating requests must include:

```
X-Grading-Secret: <shared secret>
```

The shared secret is configured via the `GRADING_SECRET` environment variable on the
service.  The backend must read the same value from its own environment and forward it
with every request.

If `GRADING_SECRET` is empty the auth check is skipped (local development only).

---

## Endpoints

### `GET /health`

Liveness check.  Returns `200 OK` when the service is up.

**Response**

```json
{ "status": "ok" }
```

---

### `POST /grade`

Grade a card photo.

**Request headers**

| Header             | Required | Description                     |
|--------------------|----------|---------------------------------|
| `X-Grading-Secret` | Yes      | Shared secret (see Auth above)  |
| `Content-Type`     | Yes      | `application/json`              |

**Request body**

```json
{
  "photoUrl": "https://your-s3-bucket.s3.amazonaws.com/cards/abc123.jpg"
}
```

| Field      | Type   | Description                                           |
|------------|--------|-------------------------------------------------------|
| `photoUrl` | string | Publicly readable URL of the card photo (JPEG / PNG) |

**Successful response — `200 OK`**

```json
{
  "grade": "NM",
  "confidence": 0.82,
  "detectedSet": "Base Set",
  "detectedName": "Charizard",
  "detectedRarity": null
}
```

| Field            | Type           | Description                                                                |
|------------------|----------------|----------------------------------------------------------------------------|
| `grade`          | string \| null | Condition label (see table below), or `null` when confidence is too low    |
| `confidence`     | number         | Grading confidence in `[0, 1]`                                             |
| `detectedSet`    | string \| null | Recognised set name, or `null` if unrecognised                             |
| `detectedName`   | string \| null | Recognised card name, or `null` if unrecognised                            |
| `detectedRarity` | string \| null | Card rarity (not yet populated in MVP — always `null`)                     |
| `message`        | string \| null | Human-readable explanation when `grade` is `null`                          |

**Grade labels**

| Label     | Meaning            |
|-----------|--------------------|
| `"Mint"`  | Mint (MT)          |
| `"NM"`    | Near Mint          |
| `"LP"`    | Lightly Played     |
| `"MP"`    | Moderately Played  |
| `"HP"`    | Heavily Played     |
| `"Damaged"` | Damaged          |

**Low-confidence response — `200 OK`**

When grading confidence is below 0.6 (or the photo fails quality validation), `grade` is
`null` and `message` explains why.  The backend should prompt the seller to retake the
photo.

```json
{
  "grade": null,
  "confidence": 0.41,
  "detectedSet": null,
  "detectedName": null,
  "detectedRarity": null,
  "message": "photo quality insufficient"
}
```

**Error responses**

| Status | Condition                                        |
|--------|--------------------------------------------------|
| `401`  | Missing or invalid `X-Grading-Secret`            |
| `422`  | `photoUrl` could not be fetched or decoded       |
| `500`  | Internal pipeline error                          |

---

## Backend integration example (Python / httpx)

```python
import httpx

GRADING_SERVICE_URL = os.environ["GRADING_SERVICE_URL"]  # e.g. http://grading-service:8001
GRADING_SECRET      = os.environ["GRADING_SECRET"]

async def call_grading_service(photo_url: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{GRADING_SERVICE_URL}/grade",
            json={"photoUrl": photo_url},
            headers={"X-Grading-Secret": GRADING_SECRET},
        )
        resp.raise_for_status()
        return resp.json()
```

---

## Environment variables

| Variable         | Required | Default    | Description                                      |
|------------------|----------|------------|--------------------------------------------------|
| `GRADING_SECRET` | No*      | `""`       | Shared secret for auth (*required in production) |
| `LOG_LEVEL`      | No       | `INFO`     | Python logging level                             |

---

## Pipeline internals

The service runs the following stages for each request:

1. **Photo validation** (`ml/photo_validator.py`) — checks resolution, blur, lighting,
   and card presence.  Fails fast with `grade: null` when the image is unsuitable.
2. **Card normalisation** (`ml/card_normalizer.py`) — perspective-corrects the card and
   applies CLAHE lighting normalisation to produce a 224×312 px BGR image.
3. **Card recognition** (`ml/card_recognizer.py`) — perceptual-hash lookup against a
   pre-built index of Pokémon TCG card images.  Falls back to the PokémonTCG API.
4. **Condition grading** (`ml/grader.py`) — runs EfficientNet-B4 if weights are present,
   otherwise falls back to the heuristic OpenCV grader.

### Swapping the grading model

Place fine-tuned EfficientNet-B4 weights at:

```
ml/models/grader_efficientnet_b4.pt
```

The service picks them up automatically on next start without any code change.

### Building the card hash index

Run once (requires internet access and the `pokemontcgsdk` package):

```bash
python -m ml.card_recognizer --build-index
# Optional: limit to 500 cards for testing
python -m ml.card_recognizer --build-index --limit 500
```

The index is saved to `ml/models/card_hash_index.npz`.
