> ## Documentation Index
> Fetch the complete documentation index at: https://docs.kie.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get 4K Video Callbacks

> When video generation completes, the system calls this callback to notify results

<Info>
  When the 4K video generation task completes, the system will notify you of the results through callback mechanism.
</Info>

### Callback Configuration

Configure the callback URL when requesting 4K video generation:

```json  theme={null}
{
  "taskId": "veo_task_abcdef123456",
  "index": 0,
  "callBackUrl": "https://your-domain.com/api/4k-callback"
}
```

### Callback Format

When 4K video generation completes, the system will send a POST request to your configured callback URL with the following format:

<CodeGroup>
  ```json Success Callback Result theme={null}
  {
    "code": 200,
    "msg": "4K Video generated successfully.",
    "data": {
      "taskId": "veo_task_example123",
      "info": {
        "resultUrls": [
          "https://file.aiquickdraw.com/v/example_task_1234567890.mp4"
        ],
        "imageUrls": [
          "https://file.aiquickdraw.com/v/example_task_1234567890.jpg"
        ]
      }
    }
  }
  ```

  ```json Failure Callback Result theme={null}
  {
    "code": 500,
    "msg": "The 4K version of this video is unavailable. Please try a different video.",
    "data": {
      "taskId": "veo_task_abcdef123456",
    }
  }
  ```
</CodeGroup>

### Callback Field Descriptions

| Field                  | Type           | Description                                                                                   |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `code`                 | integer        | Status code, 200 indicates success, 500 indicates failure                                     |
| `msg`                  | string         | Status message, success shows "4K Video generated successfully.", failure shows error message |
| `data`                 | object \| null | Task result data when successful, null when failed                                            |
| `data.taskId`          | string         | Task ID                                                                                       |
| `data.info`            | object         | Object containing detailed result information                                                 |
| `data.info.resultUrls` | array          | Generated 4K video URL array                                                                  |
| `data.info.imageUrls`  | array          | Related thumbnail or preview image URL array                                                  |

### Callback Handling

<Steps>
  <Step title="Verify Callback">
    Check the `code` field to confirm generation success
  </Step>

  <Step title="Extract Results">
    Retrieve the generated 4K video download address from `data.info.resultUrls`
  </Step>

  <Step title="Respond to Callback">
    Your server should return a 200 status code to confirm callback receipt
  </Step>
</Steps>

### Error Handling

If errors occur during 4K video generation, the callback will return an error status code with the corresponding error message. Currently supported error cases include:

* **500**: 4K version unavailable - "The 4K version of this video is unavailable. Please try a different video."

<Warning>
  Ensure your callback endpoint can handle duplicate callbacks to avoid processing the same task multiple times.
</Warning>

## Best Practices

<Tip>
  ### 4K Video Generation Callback Handling Recommendations

  1. **Timely Download**: 4K video files are large and URLs may have validity period limitations, please download and save promptly
  2. **Idempotent Processing**: The same task may receive multiple callbacks, ensure processing logic is idempotent
  3. **Error Retry**: If you receive a 4K unavailable error, you can try using a different video or contact technical support
  4. **Media Management**: Use the returned data for media file management and tracking
  5. **Storage Planning**: 4K video files are typically very large, ensure sufficient storage space
</Tip>

## Alternative Solutions

If you cannot use the callback mechanism, you can also use polling:

<Card title="Poll Query Results" icon="radar" href="/veo3-api/get-veo-3-video-details">
  Use the Get Video Details endpoint to periodically query 4K video generation task status.
</Card>
