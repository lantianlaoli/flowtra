# Blog Video Support Test

This is a test document demonstrating the various video formats and syntax that the blog system now supports.

## Supported Syntax

### 1. HTML5 video tag
```html
<video src="https://example.com/video.mp4" controls></video>
```

### 2. Image syntax for video files
```markdown
![Video description](https://example.com/video.mp4)
![Another video](https://example.com/demo.webm)
```

### 3. YouTube videos
```markdown
![YouTube video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
![YouTube short link](https://youtu.be/dQw4w9WgXcQ)
```

### 4. Bilibili videos
```markdown
![Bilibili video](https://www.bilibili.com/video/BV1xx411c7mu)
```

### 5. Vimeo videos
```markdown
![Vimeo video](https://vimeo.com/123456789)
```

## Supported Video Formats

- MP4 (.mp4)
- WebM (.webm)
- OGG (.ogg)
- MOV (.mov)
- AVI (.avi)

## Features

✅ Custom video player
✅ Responsive design
✅ Playback controls (play/pause, volume, progress bar, fullscreen)
✅ YouTube/Bilibili/Vimeo auto-embed
✅ Loading state display
✅ Error handling
✅ Keyboard shortcut support
✅ Touch device friendly

## Usage Recommendations

1. **Direct video files**: Suitable for videos hosted on your own server
2. **Platform embedding**: Suitable for videos from YouTube, Bilibili and other platforms
3. **Responsive**: All videos automatically adapt to container width
4. **Performance optimization**: Videos don't auto-play by default to save bandwidth

Test complete! The blog now fully supports video content.