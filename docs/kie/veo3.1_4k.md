> ## Documentation Index
> Fetch the complete documentation index at: https://docs.kie.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get 4K Video

> Get the ultra-high-definition 4K version of a Veo3.1 video generation task.

<Info>
  Get the ultra-high-definition 4K version of a Veo 3.1 video generation task.
</Info>

<Note>
  Legacy note: If a task was generated via a deprecated fallback path, this endpoint may not apply.
</Note>

### Usage Instructions

* **API method difference**
  * **1080P** uses **GET**: `/api/v1/veo/get-1080p-video`
  * **4K** uses **POST**: `/api/v1/veo/get-4k-video`
* **Credit consumption**
  * 4K requires **additional credits**.
  * The extra cost is approximately **equivalent to 2× “Fast mode” video generations** (see [pricing details](https://kie.ai/pricing) for the latest).
* **Supported aspect ratios**
  * Both **16:9** and **9:16** tasks support upgrading to **1080P** and **4K**.
* **Processing time**
  * 4K generation requires significant extra processing time — typically **\~5–10 minutes** depending on load.
* If the 4K video is not ready yet, the endpoint may return a non-200 code. Wait and retry (recommended interval: **30s+**) until the result is available.

<Tip>
  For production use, we recommend using `callBackUrl` to receive automatic notifications when 4K generation completes, rather than polling frequently.
</Tip>

## Callbacks

After submitting a 4K video generation task, use the unified callback mechanism to receive generation completion notifications:

<Card title="4K Video Generation Callbacks" icon="bell" href="/veo3-api/get-veo-3-4k-video-callbacks">
  Learn how to configure and handle 4K video generation callback notifications
</Card>

## Error Responses

When submitting repeated requests for the same task ID, the system returns a `422` status code with specific error details:

<CodeGroup>
  ```json 4K Video Processing theme={null}
  {
    "code": 422,
    "msg": "4k is processing. It should be ready in 5-10 minutes. Please check back shortly.",
    "data": {
      "taskId": "veo_task_example123",
      "resultUrls": null,
      "imageUrls": null
    }
  }
  ```

  ```json 4K Video Already Generated theme={null}
  {
    "code": 422,
    "msg": "The video has been generated successfully",
    "data": {
      "taskId": "veo_task_example123",
      "resultUrls": [
        "https://tempfile.aiquickdraw.com/v/example_task_1234567890.mp4"
      ],
      "imageUrls": [
        "https://tempfile.aiquickdraw.com/v/example_task_1234567890.jpg"
      ]
    }
  }
  ```
</CodeGroup>


## OpenAPI

````yaml veo3-api/veo3-api.json post /api/v1/veo/get-4k-video
openapi: 3.0.0
info:
  title: Veo3.1 API
  description: kie.ai Veo3.1 API Documentation - Text-to-Video and Image-to-Video API
  version: 1.0.0
  contact:
    name: Technical Support
    email: support@kie.ai
servers:
  - url: https://api.kie.ai
    description: API Server
security:
  - BearerAuth: []
paths:
  /api/v1/veo/get-4k-video:
    post:
      summary: Get 4K Video
      description: >-
        Get the ultra-high-definition 4K version of a Veo3.1 video generation
        task.
      operationId: get-veo3-1-4k-video
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - taskId
              properties:
                taskId:
                  type: string
                  description: Task ID
                  example: veo_task_abcdef123456
                index:
                  type: integer
                  description: video index
                  default: 0
                  example: 0
                callBackUrl:
                  type: string
                  format: uri
                  description: >-
                    The URL to receive 4K video generation task completion
                    updates. Optional but recommended for production use.


                    - System will POST task status and results to this URL when
                    4K video generation completes

                    - Callback includes generated video URLs, media IDs, and
                    related information

                    - Your callback endpoint should accept POST requests with
                    JSON payload containing results

                    - Alternatively, use the Get Video Details endpoint to poll
                    task status
                  example: http://your-callback-url.com/4k-callback
            example:
              taskId: veo_task_abcdef123456
              index: 0
              callBackUrl: http://your-callback-url.com/4k-callback
      responses:
        '200':
          description: Request successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    enum:
                      - 200
                      - 401
                      - 404
                      - 422
                      - 429
                      - 451
                      - 455
                      - 500
                    description: >-
                      Response status code


                      - **200**: Success - Request has been processed
                      successfully

                      - **401**: Unauthorized - Authentication credentials are
                      missing or invalid

                      - **404**: Not Found - The requested resource or endpoint
                      does not exist

                      - **422**: Validation Error - The request parameters
                      failed validation checks.

                      record is null.

                      Temporarily supports records within 14 days.

                      record result data is blank.

                      record status is not success.

                      record result data not exist.

                      record result data is empty.

                      - **429**: Rate Limited - Request limit has been exceeded
                      for this resource

                      - **451**: Failed to fetch the image. Kindly verify any
                      access limits set by you or your service provider.

                      - **455**: Service Unavailable - System is currently
                      undergoing maintenance

                      - **500**: Server Error - An unexpected error occurred
                      while processing the request
                  msg:
                    type: string
                    description: Error message when code != 200
                    example: success
                  data:
                    type: object
                    properties:
                      taskId:
                        type: string
                        description: >-
                          Task ID, can be used with Get Video Details endpoint
                          to query task status
                        example: veo_task_abcdef123456
                      resultUrls:
                        type: array
                        items:
                          type: string
                        description: Generated 4K video URLs
                        example:
                          - >-
                            https://file.aiquickdraw.com/v/example_task_1234567890.mp4
                      imageUrls:
                        type: array
                        items:
                          type: string
                        description: Related thumbnail or preview image URLs
                        example:
                          - >-
                            https://file.aiquickdraw.com/v/example_task_1234567890.jpg
              example:
                code: 200
                msg: success
                data:
                  taskId: veo_task_abcdef123456
                  resultUrls: null
                  imageUrls: null
        '500':
          $ref: '#/components/responses/Error'
      callbacks:
        on4KVideoGenerated:
          '{$request.body#/callBackUrl}':
            post:
              summary: 4K Video Generation Callback
              description: >-
                When the 4K video generation task completes, the system will
                send a POST request to your configured callback URL
              requestBody:
                required: true
                content:
                  application/json:
                    schema:
                      type: object
                      properties:
                        code:
                          type: integer
                          description: >-
                            Status code


                            - **200**: Success - 4K video generation task
                            successful
                          enum:
                            - 200
                            - 400
                            - 500
                        msg:
                          type: string
                          description: Status message
                          example: 4K Video generated successfully.
                        data:
                          type: object
                          properties:
                            task_id:
                              type: string
                              description: Task ID
                              example: bf3e7adb-fb6c-4257-bbcd-470787386fb0
                            result_urls:
                              type: array
                              items:
                                type: string
                              description: Generated 4K video URLs
                              example:
                                - >-
                                  https://file.aiquickdraw.com/p/d1301f0aa3f647c1ab7bb1f60ef006c0_1750236843.mp4
                            media_ids:
                              type: array
                              items:
                                type: string
                              description: Media IDs
                              example:
                                - >-
                                  CAUaJDQ5NGYwY2NhLTE1NTUtNDIzNS1iNjJiLWE0OWE4NzMxNjMzOCIDQ0FFKi4xMDJlOTA5MS01NGJlLTQzN2EtODhkMC01NWNkNGUxNTllNTNfdXBzYW1wbGVk
                            image_urls:
                              type: array
                              items:
                                type: string
                              description: Related image URLs
                              example:
                                - >-
                                  https://tempfile.aiquickdraw.com/p/d1301f0aa3f647c1ab7bb1f60ef006c0_1750236843.jpg
              responses:
                '200':
                  description: Callback received successfully
components:
  responses:
    Error:
      description: Server Error
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key
      description: >-
        All APIs require authentication via Bearer Token.


        Get API Key: 

        1. Visit [API Key Management Page](https://kie.ai/api-key) to get your
        API Key


        Usage:

        Add to request header:

        Authorization: Bearer YOUR_API_KEY

````