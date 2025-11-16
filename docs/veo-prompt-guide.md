# 概览

Veo 是一款支持“文字生成视频”（text-to-video）以及“图片生成视频”（image-to-video）的生成模型，由 Veo 在 Vertex AI 平台上提供。你需要为模型提供一个「提示词」（prompt）——即你希望模型生成什么内容的文字说明。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))

该指南提供了如何撰写提示词的建议、所包含的元素、以及若干示例，帮助你生成更符合预期的视频内容。 ([Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?hl=zh-cn&utm_source=chatgpt.com))

## 安全与合规过滤

Veo 会在整个 Vertex AI 生态中应用 **安全过滤机制**，以确保生成的视频或上传的照片不包含不当或冒犯性的内容。若提示词触及违反“Responsible AI”原则的内容，可能会被屏蔽。 ([Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?hl=zh-cn&utm_source=chatgpt.com))

如果你发现可能的滥用或生成输出包含不当/不准确内容，可使用 Google Cloud 的“疑似滥用行为”举报表单。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))

## 撰写提示词的基础

为了让生成的视频更贴近你的意图，建议提示词清晰且具描述性。一般来说，一个提示词可以包括以下几个核心要素： ([Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?hl=zh-cn&utm_source=chatgpt.com))

1. **主体（Subject）** —— 你希望视频中出现的对象、人物、动物或场景。 ([Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?hl=zh-cn&utm_source=chatgpt.com))
2. **环境／背景（Context / Environment）** —— 主体所处的背景、地点或环境。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
3. **动作（Action）** —— 主体正在做什么，例如：走、跑、转头、挥手。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
4. **风格（Style）** —— 视频的视觉风格或氛围，比如电影感、卡通感、未来风格、黑白、复古等。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
5. **摄像机运动／视角（Camera motion / positioning）**（可选）—— 镜头从哪个角度拍摄，如俯拍、仰拍、航拍、跟拍等。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
6. **构图（Composition）**（可选）—— 镜头的取景方式：近景、特写、广角、低角度等。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
7. **氛围／色彩（Ambiance / colour & lighting）**（可选）—— 环境的色彩、光线、时间（黄昏、夜晚、晨雾）、情绪（忧郁、欢快）等。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))
8. **音频（Audio）** —— 如果你希望视频带音频或音效，可在提示词中明确描述。 ([Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?utm_source=chatgpt.com))

在撰写时，建议先确定「核心概念」（主体+环境+动作），然后再通过关键字和修饰词去优化“风格、构图、氛围、摄像机运动”等元素，从而使生成效果更贴近预期。 ([Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide?hl=zh-cn&utm_source=chatgpt.com))

## 提示词元素详解与示例

下面按提示词中常用的几个元素，分别说明其含义，并给出示例。所有示例皆参考原文指南。

### 主体（Subject）

说明你希望看到什么／谁。可以是一个对象、一个人、一群人、动物、场景中的特定物体。

**示例**：

> “白色混凝土公寓楼” —— 提示中直接指定了建筑物。 (Google Cloud)
> 

### 环境／背景（Context）

说明主体所处的背景或场景。通过改变环境，你可以大幅改变画面效果。

**示例**：

> “悬浮在外太空的卫星，背景有月球和星星。” —— 提示中环境是「外太空」。 (Google Cloud)
> 

### 动作（Action）

说明主体在做什么。将“静态”物体转成“动作”场景更具动态感。

**示例**：

> “一个女人走在海滩上，望向地平线，在夕阳下” —— 提示中明确了“走”“望向地平线”动作。 (Google Cloud)
> 

### 风格（Style）

给视频设定整体视觉或艺术风格。

**示例**：

> “电影黑色片风格，男人和女人走在街上，神秘、电影感、黑白” —— 提示中用了“电影黑色片风格”“黑白”关键词。 (Google Cloud)
> 

### 摄像机运动／视角（Camera motion）

说明镜头如何运作或拍摄视角。

**示例**：

> “POV 镜头，自一辆复古汽车驾在雨夜中，加拿大，电影感。” —— “POV shot”“复古汽车”“雨夜”说明镜头视角与运动。 (Google Cloud)
> 

### 构图（Composition）

说明画面中主体与镜头之间的取景方式、大小关系。

**示例**：

> “极近特写：一个人的眼睛，城市场景映在眼中。” —— 特写＋环境反射。 (Google Cloud)
> 

### 氛围／色彩（Ambiance）

说明视频的整体情绪、色调、光线、时间状态。

**示例**：

> “电影感特写：一名在雨中乘公共汽车的悲伤女子，冷蓝色调，忧郁氛围。” —— 提示中“冷蓝色调”“雨中”“忧郁”说明氛围。 (Google Cloud)
> 

### 音频（Audio）

如果希望视频带声音，可在提示中另起一句描述音效或对话。

**示例**：

> 在提示中写：“音效：雨滴敲打路面声。对话：她低语 ‘我们走吧’。” —— 说明环境音与对白。 （示例组合自本文档类似结构）
> 

## 提示词示例

（从指南中整理改写）

> “特写镜头：冰冻岩壁上融化的冰柱，冷蓝色调，镜头缓缓拉近，聚焦水珠从尖端滑落。” —— 这是一个较为完整的提示，具备主体（冰柱）、环境（岩壁／冰冻）、动作（融化、水滴滑落）、构图（特写＋拉近）、氛围（冷蓝色）等。 (Google Cloud Documentation)
> 

相比之下：

> “一棵树在风中摇晃。” —— 很简略，缺乏环境、构图、风格、情绪等细节，模型生成结果可能偏泛。
> 

## 快速撰写模板

你可以参考以下结构来撰写提示词：

```
[摄像机视角／镜头类型]。
[主体] 在 [场景＋时间＋环境] 中 正在 [动作]。
[摄像机运动]。
[灯光与色调／氛围]。
风格： [视觉风格关键词]。
音频： [对话／环境声／音乐]。
```

**示例**：

> “中景，平视角。一名穿黄雨衣的女子在霓虹闪烁的东京小巷中疾步，手握碎伞。摄像机从背后跟拍并在她转身时缓慢推前。街道湿滑反射霓虹灯光，雨丝在空气中挥舞。风格：电影黑色风。音频：她低声说：“我们走吧。” 背景可听到雨滴敲击路面和远处汽车发动声。”
>