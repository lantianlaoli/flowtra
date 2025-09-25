# Generate Veo 3 AI Video(Fast&Quality)

> Create a new video generation task using the Veo3 AI model.

## OpenAPI

````yaml veo3-api/veo3-api.json post /api/v1/veo/generate
paths:
  path: /api/v1/veo/generate
  method: post
  servers:
    - url: https://api.kie.ai
      description: API Server
  request:
    security:
      - title: BearerAuth
        parameters:
          query: {}
          header:
            Authorization:
              type: http
              scheme: bearer
              description: >-
                All APIs require authentication via Bearer Token.


                Get API Key: 

                1. Visit [API Key Management Page](https://kie.ai/api-key) to
                get your API Key


                Usage:

                Add to request header:

                Authorization: Bearer YOUR_API_KEY
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              prompt:
                allOf:
                  - type: string
                    description: >-
                      Text prompt describing the desired video content. Required
                      for all generation modes.


                      - Should be detailed and specific in describing video
                      content

                      - Can include actions, scenes, style and other information

                      - For image-to-video, describe how you want the image to
                      come alive
                    example: A dog playing in a park
              imageUrls:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      Image URL list (used in image-to-video mode, only 1 image
                      supported for now).


                      - Must be valid image URLs

                      - Images must be accessible to the API server— links that
                      require redirects (e.g. 301/302), temporary or expiring
                      URLs, private cloud storage links without proper
                      permissions, or links behind authentication will not work.
                    example:
                      - http://example.com/image1.jpg
              model:
                allOf:
                  - type: string
                    description: >-
                      Select the model type to use.


                      - veo3: Veo 3 Quality, supports both text-to-video and
                      image-to-video generation

                      - veo3_fast: Fast generation model, supports both
                      text-to-video and image-to-video generation
                    enum:
                      - veo3
                      - veo3_fast
                    default: veo3
                    example: veo3
              aspectRatio:
                allOf:
                  - type: string
                    description: >-
                      Video aspect ratio. Specifies the dimension ratio of the
                      generated video. Available options:


                      - 16:9: Landscape video format, supports 1080P HD video
                      generation (**Only 16:9 aspect ratio supports 1080P**)

                      - 9:16: Portrait video format, suitable for mobile short
                      videos


                      Default value is 16:9.
                    enum:
                      - '16:9'
                      - '9:16'
                      - Auto
                    default: '16:9'
                    example: '16:9'
              seeds:
                allOf:
                  - type: integer
                    description: >-
                      (Optional) Random seed parameter to control the randomness
                      of the generated content. Value range: 10000-99999. The
                      same seed will generate similar video content, different
                      seeds will generate different content. If not provided,
                      the system will assign one automatically.
                    minimum: 10000
                    maximum: 99999
                    example: 12345
              callBackUrl:
                allOf:
                  - type: string
                    description: >-
                      Completion callback URL for receiving video generation
                      status updates.


                      - Optional but recommended for production use

                      - System will POST task completion status to this URL when
                      the video generation is completed

                      - Callback will include task results, video URLs, and
                      status information

                      - Your callback endpoint should accept POST requests with
                      JSON payload

                      - For detailed callback format and implementation guide,
                      see [Callback
                      Documentation](./generate-veo-3-video-callbacks)

                      - Alternatively, use the Get Video Details endpoint to
                      poll task status
                    example: http://your-callback-url.com/complete
              enableFallback:
                allOf:
                  - type: boolean
                    description: >-
                      Enable fallback functionality. When set to true, if the
                      official Veo3 video generation service is unavailable or
                      encounters exceptions, the system will automatically
                      switch to a backup model for video generation to ensure
                      task continuity and reliability. Default value is false.


                      - When fallback is enabled, backup model will be used for
                      the following errors:
                        - public error minor upload
                        - Your prompt was flagged by Website as violating content policies
                        - public error prominent people upload
                      - Fallback mode requires 16:9 aspect ratio and uses 1080p
                      resolution by default

                      - **Note**: Videos generated through fallback mode cannot
                      be accessed via the Get 1080P Video endpoint

                      - **Credit Consumption**: Successful fallback has
                      different credit consumption, please see
                      https://kie.ai/billing for billing details
                    default: false
                    example: false
              enableTranslation:
                allOf:
                  - type: boolean
                    description: >-
                      Enable prompt translation to English. When set to true,
                      the system will automatically translate prompts to English
                      before video generation for better generation results.
                      Default value is true.


                      - true: Enable translation, prompts will be automatically
                      translated to English

                      - false: Disable translation, use original prompts
                      directly for generation
                    default: true
                    example: true
              watermark:
                allOf:
                  - type: string
                    description: >-
                      Watermark text.


                      - Optional parameter

                      - If provided, a watermark will be added to the generated
                      video
                    example: MyBrand
            required: true
            requiredProperties:
              - prompt
            example:
              prompt: A dog playing in a park
              imageUrls:
                - http://example.com/image1.jpg
              model: veo3
              watermark: MyBrand
              callBackUrl: http://your-callback-url.com/complete
              aspectRatio: '16:9'
              seeds: 12345
              enableFallback: false
              enableTranslation: true
        examples:
          example:
            value:
              prompt: A dog playing in a park
              imageUrls:
                - http://example.com/image1.jpg
              model: veo3
              watermark: MyBrand
              callBackUrl: http://your-callback-url.com/complete
              aspectRatio: '16:9'
              seeds: 12345
              enableFallback: false
              enableTranslation: true
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              code:
                allOf:
                  - type: integer
                    enum:
                      - 200
                      - 400
                      - 401
                      - 402
                      - 404
                      - 422
                      - 429
                      - 455
                      - 500
                      - 501
                      - 505
                    description: >-
                      Response status code


                      - **200**: Success - Request has been processed
                      successfully

                      - **400**: 1080P is processing. It should be ready in 1-2
                      minutes. Please check back shortly.

                      - **401**: Unauthorized - Authentication credentials are
                      missing or invalid

                      - **402**: Insufficient Credits - Account does not have
                      enough credits to perform the operation

                      - **404**: Not Found - The requested resource or endpoint
                      does not exist

                      - **422**: Validation Error - Request parameters failed
                      validation. When fallback is not enabled and generation
                      fails, error message format: Your request was rejected by
                      Flow(original error message). You may consider using our
                      other fallback channels, which are likely to succeed.
                      Please refer to the documentation.

                      - **429**: Rate Limited - Request limit has been exceeded
                      for this resource

                      - **455**: Service Unavailable - System is currently
                      undergoing maintenance

                      - **500**: Server Error - An unexpected error occurred
                      while processing the request

                      - **501**: Generation Failed - Video generation task
                      failed

                      - **505**: Feature Disabled - The requested feature is
                      currently disabled
              msg:
                allOf:
                  - type: string
                    description: Error message when code != 200
                    example: success
              data:
                allOf:
                  - type: object
                    properties:
                      taskId:
                        type: string
                        description: >-
                          Task ID, can be used with Get Video Details endpoint
                          to query task status
                        example: veo_task_abcdef123456
        examples:
          example:
            value:
              code: 200
              msg: success
              data:
                taskId: veo_task_abcdef123456
        description: Request successful
    '500':
      _mintlify/placeholder:
        schemaArray:
          - type: any
            description: Server Error
        examples: {}
        description: Server Error
  deprecated: false
  type: path
components:
  schemas: {}

````