# Ffmpeg Api

> Use ffmpeg capabilities to merge 2 or more videos.


## Overview

- **Endpoint**: `https://fal.run/fal-ai/ffmpeg-api/merge-videos`
- **Model ID**: `fal-ai/ffmpeg-api/merge-videos`
- **Category**: video-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`video_urls`** (`list<string>`, _required_):
  List of video URLs to merge in order
  - Array of string

- **`target_fps`** (`float`, _optional_):
  Target FPS for the output video. If not provided, uses the lowest FPS from input videos.
  - Range: `1` to `60`

- **`resolution`** (`ImageSize | Enum`, _optional_):
  Resolution of the final video. Width and height must be between 512 and 2048.
  - One of: ImageSize | Enum



**Required Parameters Example**:

```json
{}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  Merged video file

- **`metadata`** (`Metadata`, _required_):
  Metadata about the merged video including original video info



**Example Response**:

```json
{
  "video": {
    "url": "",
    "content_type": "image/png",
    "file_name": "z9RV14K95DvU.png",
    "file_size": 4404019
  }
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/ffmpeg-api/merge-videos \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{}'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/ffmpeg-api/merge-videos",
    arguments={},
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
  input: {},
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/ffmpeg-api/merge-videos)
- [API Documentation](https://fal.ai/models/fal-ai/ffmpeg-api/merge-videos/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/ffmpeg-api/merge-videos)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)
