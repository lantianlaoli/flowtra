# 博客视频支持测试

这是一个测试文档，展示博客系统现在支持的各种视频格式和语法。

## 支持的语法

### 1. HTML5 video 标签
```html
<video src="https://example.com/video.mp4" controls></video>
```

### 2. 图片语法识别视频文件
```markdown
![视频描述](https://example.com/video.mp4)
![另一个视频](https://example.com/demo.webm)
```

### 3. YouTube 视频
```markdown
![YouTube视频](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
![YouTube短链接](https://youtu.be/dQw4w9WgXcQ)
```

### 4. Bilibili 视频
```markdown
![Bilibili视频](https://www.bilibili.com/video/BV1xx411c7mu)
```

### 5. Vimeo 视频
```markdown
![Vimeo视频](https://vimeo.com/123456789)
```

## 支持的视频格式

- MP4 (.mp4)
- WebM (.webm)
- OGG (.ogg)
- MOV (.mov)
- AVI (.avi)

## 功能特性

✅ 自定义视频播放器
✅ 响应式设计
✅ 播放控制（播放/暂停、音量、进度条、全屏）
✅ YouTube/Bilibili/Vimeo 自动嵌入
✅ 加载状态显示
✅ 错误处理
✅ 键盘快捷键支持
✅ 触摸设备友好

## 使用建议

1. **直接视频文件**: 适合自有服务器托管的视频文件
2. **平台嵌入**: 适合 YouTube、Bilibili 等平台的视频
3. **自适应**: 所有视频都会自动适应容器宽度
4. **性能优化**: 视频默认不自动播放，节省带宽

测试完成！博客现在完全支持视频内容了。