#!/bin/bash
curl -s 'https://api.aiquickdraw.com/third-party/api/third/v1/video-portrait-swap/query' \
  -H 'Authorization: Bearer 3bb5181f0c62012354d40540be487677' \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"50fb13a1f2ed7a651775c3366257403f"}' | jq .
