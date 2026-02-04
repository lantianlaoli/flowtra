> ## Documentation Index
> Fetch the complete documentation index at: https://docs.kie.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get 1080P Video

> Get the high-definition 1080P version of a Veo3.1 video generation task.

<Info>
  Get the high-definition 1080P version of a Veo 3.1 video generation task.
</Info>

<Note>
  Legacy note: If your task was generated via a deprecated fallback path, 1080P may already be the default output and this endpoint may not apply.
</Note>

### Usage Instructions

* 1080P generation requires extra processing time — typically **\~1–3 minutes** depending on load.
* If the 1080P video is not ready yet, the endpoint may return a non-200 code. In this case, wait a bit and retry (recommended interval: **20–30s**) until the result is available.
* Make sure the **original generation task is successful** before requesting 1080P.


## OpenAPI

````yaml veo3-api/veo3-api.json get /api/v1/veo/get-1080p-video
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
  /api/v1/veo/get-1080p-video:
    get:
      summary: Get 1080P Video
      description: Get the high-definition 1080P version of a Veo3.1 video generation task.
      operationId: get-veo3-1-1080p-video
      parameters:
        - in: query
          name: taskId
          description: Task ID
          required: true
          schema:
            type: string
          example: veo_task_abcdef123456
        - in: query
          name: index
          description: video index
          required: false
          schema:
            type: integer
          example: '0'
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
                      resultUrl:
                        type: string
                        description: 1080P high-definition video download URL
                        example: >-
                          https://tempfile.aiquickdraw.com/p/42f4f8facbb040c0ade87c27cb2d5e58_1749711595.mp4
              example:
                code: 200
                msg: success
                data:
                  resultUrl: >-
                    https://tempfile.aiquickdraw.com/p/42f4f8facbb040c0ade87c27cb2d5e58_1749711595.mp4
        '500':
          $ref: '#/components/responses/Error'
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