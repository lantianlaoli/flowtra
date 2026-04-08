import type { SiteLocale } from '@/lib/i18n/site';
import { landingMessages } from '@/lib/i18n/landing-messages';

type SiteMessages = {
  landing: (typeof landingMessages)[SiteLocale];
  common: {
    language: string;
    loading: string;
    processing: string;
    lightMode: string;
    darkMode: string;
    loadingPreview: string;
    previewUnavailable: string;
    productDemoVideo: string;
    enableVideoAudio: string;
    muteVideoAudio: string;
    soundOn: string;
    soundOff: string;
    tapForSound: string;
    browserVideoUnsupported: string;
  };
  dashboard: {
    sidebar: {
      navigation: string;
      home: string;
      agent: string;
      viralClone: string;
      avatarAds: string;
      motionClone: string;
      myAds: string;
      assets: string;
      openMenu: string;
      menu: string;
    };
    utilityDock: {
      account: string;
      language: string;
      lightMode: string;
      darkMode: string;
      backToLanding: string;
    };
    home: {
      greetingPrefix: string;
      subtitle: string;
      stats: {
        totalVideos: string;
        thisMonth: string;
        creditsUsed: string;
        hoursSaved: string;
      };
      discover: {
        title: string;
        all: string;
        viralClone: string;
        character: string;
        motionClone: string;
        failedToLoad: string;
        emptyTitle: string;
        emptyDescription: string;
      };
    };
    assets: {
      title: string;
      description: string;
    };
    support: {
      title: string;
      description: string;
      allChannels: string;
      resources: string;
      priority: string;
      links: {
        tiktok: { description: string; cta: string };
        discord: { description: string; cta: string };
        youtube: { description: string; cta: string };
        email: { description: string; cta: string };
        x: { description: string; cta: string };
        instagram: { description: string; cta: string };
        linkedin: { description: string; cta: string };
        threads: { description: string; cta: string };
      };
      resourcesList: {
        tutorial: string;
        community: string;
      };
    };
  };
  tools: {
    index: {
      eyebrow: string;
      title: string;
      description: string;
      openTool: string;
      items: Array<{
        href: string;
        title: string;
        description: string;
      }>;
    };
    aiAngleGenerator: {
      eyebrow: string;
      title: string;
      description: string;
      cardTitle: string;
      cardDescription: string;
      selectImage: string;
      chooseImage: string;
      noImageSelected: string;
      selectedFile: string;
      uploadingHelper: string;
      generatingHelper: string;
      signInAndRetry: string;
      photoSetTitle: string;
      photoSetDescription: string;
      copyUrl: string;
      copied: string;
      download: string;
      styleAnchorDescription: string;
      angleSlots: Array<{
        key: string;
        label: string;
        description: string;
      }>;
    };
  };
  featurePages: {
    aiAgent: {
      title: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
      mediaLabels: {
        referenceVideo: string;
        result: string;
      };
      stepsEyebrow: string;
      stepsTitle: string;
      steps: Array<{
        title: string;
        description: string;
      }>;
      benefits: {
        workflow: {
          title: string;
          bullets: string[];
        };
        naming: {
          title: string;
          bullets: string[];
        };
      };
      signup: {
        title: string;
        description: string;
      };
    };
  };
  support: {
    backToHome: string;
    title: string;
    description: string;
    priority: string;
    commonQuestions: string;
    questions: Array<{
      question: string;
      answer: string;
    }>;
    links: {
      tiktok: { description: string; cta: string };
      discord: { description: string; cta: string };
      youtube: { description: string; cta: string };
      email: { description: string; cta: string };
      x: { description: string; cta: string };
      instagram: { description: string; cta: string };
      linkedin: { description: string; cta: string };
      threads: { description: string; cta: string };
    };
  };
  error: {
    title: string;
    description: string;
    retry: string;
    backToHome: string;
    details: string;
  };
};

export const siteMessages: Record<SiteLocale, SiteMessages> = {
  en: {
    landing: landingMessages.en,
    common: {
      language: 'Language',
      loading: 'Loading...',
      processing: 'Processing...',
      lightMode: 'Light',
      darkMode: 'Dark',
      loadingPreview: 'Loading preview…',
      previewUnavailable: 'Preview unavailable',
      productDemoVideo: 'Product demonstration video',
      enableVideoAudio: 'Enable video audio',
      muteVideoAudio: 'Mute video audio',
      soundOn: 'Sound on',
      soundOff: 'Sound off',
      tapForSound: 'Tap for sound',
      browserVideoUnsupported: 'Your browser does not support the video tag.',
    },
    dashboard: {
      sidebar: {
        navigation: 'Dashboard navigation',
        home: 'Home',
        agent: 'Agent',
        viralClone: 'Video Clone',
        avatarAds: 'Avatar Ads',
        motionClone: 'Motion Clone',
        myAds: 'My Ads',
        assets: 'Assets',
        openMenu: 'Open menu',
        menu: 'Menu',
      },
      utilityDock: {
        account: 'Account',
        language: 'Language',
        lightMode: 'Light Mode',
        darkMode: 'Dark Mode',
        backToLanding: 'Back to Landing',
      },
      home: {
        greetingPrefix: 'Hello',
        subtitle: 'Your creative dashboard at a glance',
        stats: {
          totalVideos: 'Total Videos',
          thisMonth: 'This Month',
          creditsUsed: 'Credits Used',
          hoursSaved: 'Hours Saved',
        },
        discover: {
          title: 'Discover',
          all: 'All',
          viralClone: 'Viral Clone',
          character: 'Character',
          motionClone: 'Motion Clone',
          failedToLoad: 'Failed to load content',
          emptyTitle: 'No recent discover content',
          emptyDescription:
            'Older temporary KIE media has expired. New completed projects will appear here automatically.',
        },
      },
      assets: {
        title: 'Assets',
        description: 'Manage your products, avatars, and videos in one unified place',
      },
      support: {
        title: 'Support & Contact',
        description:
          "We're here to help. Choose the best channel to reach us. TikTok is our fastest way to respond.",
        allChannels: 'All Channels',
        resources: 'Resources',
        priority: 'Priority',
        links: {
          tiktok: {
            description: 'Fastest reply channel - usually within 24 hours.',
            cta: 'Send DM',
          },
          discord: {
            description: 'Join our community for real-time help and discussions.',
            cta: 'Join Discord',
          },
          youtube: {
            description: 'Tutorials, feature updates, and AI video tips.',
            cta: 'Watch Tutorials',
          },
          email: {
            description: 'For detailed inquiries and account support.',
            cta: 'Send Email',
          },
          x: {
            description: 'Quick updates and product news.',
            cta: 'Follow',
          },
          instagram: {
            description: 'Visual content and behind the scenes.',
            cta: 'View Profile',
          },
          linkedin: {
            description: 'Business partnerships and professional inquiries.',
            cta: 'Connect',
          },
          threads: {
            description: 'Community discussions and casual feedback.',
            cta: 'Join Thread',
          },
        },
        resourcesList: {
          tutorial: 'Watch the Platform Tutorial Video',
          community: 'Join our TikTok Community for updates',
        },
      },
    },
    tools: {
      index: {
        eyebrow: 'Tools',
        title: 'Marketing Utilities',
        description: 'Fast tools for campaign operations and performance analysis.',
        openTool: 'Open tool',
        items: [
          {
            href: '/tools/upload-assets',
            title: 'Upload Assets to URL',
            description: 'Upload image or video files and generate a temporary download URL.',
          },
          {
            href: '/tools/roas-calculator',
            title: 'ROAS Calculator',
            description: 'Calculate ROAS, net profit, margin, and conversion-level ad performance.',
          },
          {
            href: '/tools/ai-angle-generator',
            title: 'AI Multi-Angle Photo',
            description: 'Upload one frontal photo and generate 3 additional viewing angles.',
          },
        ],
      },
      aiAngleGenerator: {
        eyebrow: 'Tools',
        title: 'AI Multi-Angle Photo',
        description:
          'Upload one frontal photo to generate 3 additional viewing angles. Supports products, people, and pets.',
        cardTitle: 'Generate 3 additional angles',
        cardDescription:
          'Upload a JPG or PNG frontal image (minimum 300x300). Large images are automatically optimized before upload to avoid production payload limits.',
        selectImage: 'Select frontal image',
        chooseImage: 'Choose Image',
        noImageSelected: 'No image selected',
        selectedFile: 'Selected file',
        uploadingHelper: 'Optimizing, validating, and uploading your image...',
        generatingHelper:
          'Generating 3 angle photos while preserving the original style. This can take up to 2 minutes.',
        signInAndRetry: 'Sign in and try again',
        photoSetTitle: 'Photo set',
        photoSetDescription:
          'The generated angles stay locked to your reference image style instead of switching to a new rendering look.',
        copyUrl: 'Copy URL',
        copied: 'Copied',
        download: 'Download',
        styleAnchorDescription: 'This image acts as the style anchor for all generated viewing angles.',
        angleSlots: [
          {
            key: 'front_left_45',
            label: '45° Front Left',
            description:
              "Camera positioned at the subject's front-left, with the left side more visible than the right.",
          },
          {
            key: 'front_right_45',
            label: '45° Front Right',
            description:
              "Camera positioned at the subject's front-right, with the right side more visible than the left.",
          },
          {
            key: 'back_view',
            label: 'Back View',
            description:
              'Completes the rear view while preserving the same finish, palette, and overall image atmosphere.',
          },
        ],
      },
    },
    featurePages: {
      aiAgent: {
        title: 'AI Agent',
        description:
          'Build clone workflows in canvas mode, drag in people, products, videos, and functions, then launch generation from one clear visual flow.',
        primaryCta: 'Open Agent',
        secondaryCta: 'View Pricing',
        mediaLabels: {
          referenceVideo: 'Reference Video',
          result: 'Agent Result',
        },
        stepsEyebrow: 'How It Works',
        stepsTitle: 'Build the workflow in canvas mode',
        steps: [
          {
            title: 'Drag in your assets',
            description: 'Drop the person, product, and reference video cards onto the canvas to set up the workflow.',
          },
          {
            title: 'Drag in the function you want',
            description: 'Add the canvas function you need, whether it is video clone, motion clone, or batch talking-head generation.',
          },
          {
            title: 'Click start to run it',
            description: 'Start the selected function when the canvas looks right and let the agent execute the flow from there.',
          },
        ],
        benefits: {
          workflow: {
            title: 'Build clone workflows in canvas mode',
            bullets: [
              'Drag cards to rearrange the workflow and keep every generation step readable at a glance.',
              'Connect nodes quickly for video clone flows, motion clone setups, and action-driven variations.',
              'Batch-generate talking-head product videos and sales-ready character ads from one canvas.',
            ],
          },
          naming: {
            title: 'Name the assets you want and let the canvas connect them',
            bullets: [
              'Mention the exact person, product, or reference video in chat and the agent can place the matching cards on the canvas.',
              'Turn a named request into the right workflow structure for video clone, motion clone, or avatar ads without rebuilding the canvas by hand.',
              'Keep every selected asset and connection visible so follow-up edits refine the current graph instead of starting over.',
            ],
          },
        },
        signup: {
          title: 'Ready to build your first canvas workflow?',
          description: 'Create your account and start dragging assets, functions, and clone flows into place.',
        },
      },
    },
    support: {
      backToHome: 'Back to Home',
      title: 'Support & Contact',
      description:
        "We're here to help. Choose the best channel to reach us. TikTok is our fastest way to respond.",
      priority: 'Priority',
      commonQuestions: 'Common Questions',
      questions: [
        {
          question: 'How do I get started?',
          answer:
            'Click "Get Started" to sign up, select a plan that fits your needs, and start creating AI-powered videos immediately.',
        },
        {
          question: 'What payment methods do you accept?',
          answer:
            'We accept all major credit cards, PayPal, and various other payment methods through our secure payment processor.',
        },
        {
          question: 'Can I upgrade or downgrade my plan?',
          answer:
            'We offer one-time purchase plans. You can purchase additional credits at any time to fit your needs.',
        },
        {
          question: 'What is your refund policy?',
          answer:
            'If you encounter issues with your purchase or are not satisfied, please contact us via TikTok or email within 7 days for assistance.',
        },
      ],
      links: {
        tiktok: {
          description: 'Fastest reply channel - usually within 24 hours.',
          cta: 'Send DM',
        },
        discord: {
          description: 'Join our community for real-time help and discussions.',
          cta: 'Join Discord',
        },
        youtube: {
          description: 'Tutorials, feature updates, and AI video tips.',
          cta: 'Watch Tutorials',
        },
        email: {
          description: 'For detailed inquiries and account support.',
          cta: 'Send Email',
        },
        x: {
          description: 'Quick updates and product news.',
          cta: 'Follow',
        },
        instagram: {
          description: 'Visual content and behind the scenes.',
          cta: 'View Profile',
        },
        linkedin: {
          description: 'Business partnerships and professional inquiries.',
          cta: 'Connect',
        },
        threads: {
          description: 'Community discussions and casual feedback.',
          cta: 'Join Thread',
        },
      },
    },
    error: {
      title: 'Unexpected Error',
      description:
        'Sorry, the application encountered a problem. We have logged this error and are working on a fix.',
      retry: 'Retry',
      backToHome: 'Back to Home',
      details: 'Show Error Details (Development Mode)',
    },
  },
  zh: {
    landing: landingMessages.zh,
    common: {
      language: '语言',
      loading: '加载中...',
      processing: '处理中...',
      lightMode: '浅色',
      darkMode: '深色',
      loadingPreview: '预览加载中…',
      previewUnavailable: '预览暂不可用',
      productDemoVideo: '产品演示视频',
      enableVideoAudio: '开启视频声音',
      muteVideoAudio: '关闭视频声音',
      soundOn: '声音已开',
      soundOff: '声音已关',
      tapForSound: '点击开启声音',
      browserVideoUnsupported: '你的浏览器不支持视频播放。',
    },
    dashboard: {
      sidebar: {
        navigation: '控制台导航',
        home: '首页',
        agent: '智能体',
        viralClone: '视频克隆',
        avatarAds: '数字人广告',
        motionClone: '动作克隆',
        myAds: '我的广告',
        assets: '素材库',
        openMenu: '打开菜单',
        menu: '菜单',
      },
      utilityDock: {
        account: '账户',
        language: '语言',
        lightMode: '浅色模式',
        darkMode: '深色模式',
        backToLanding: '返回首页',
      },
      home: {
        greetingPrefix: '你好',
        subtitle: '你的创意工作台概览',
        stats: {
          totalVideos: '总视频数',
          thisMonth: '本月',
          creditsUsed: '已用积分',
          hoursSaved: '节省小时',
        },
        discover: {
          title: '发现',
          all: '全部',
          viralClone: '爆款克隆',
          character: '角色',
          motionClone: '动作克隆',
          failedToLoad: '内容加载失败',
          emptyTitle: '暂无最新发现内容',
          emptyDescription: '较早的临时 KIE 媒体已过期。新的已完成项目会自动显示在这里。',
        },
      },
      assets: {
        title: '素材库',
        description: '在一个统一空间中管理你的产品、角色和视频素材',
      },
      support: {
        title: '支持与联系',
        description: '我们会协助你解决问题。选择最适合的渠道联系我们。TikTok 是我们回复最快的渠道。',
        allChannels: '全部渠道',
        resources: '资源',
        priority: '优先',
        links: {
          tiktok: {
            description: '回复最快的渠道，通常 24 小时内答复。',
            cta: '发送私信',
          },
          discord: {
            description: '加入社区，获取实时帮助和讨论。',
            cta: '加入 Discord',
          },
          youtube: {
            description: '教程、功能更新与 AI 视频技巧。',
            cta: '观看教程',
          },
          email: {
            description: '适合详细咨询和账户支持。',
            cta: '发送邮件',
          },
          x: {
            description: '查看快速更新和产品动态。',
            cta: '关注',
          },
          instagram: {
            description: '查看视觉内容和幕后花絮。',
            cta: '查看主页',
          },
          linkedin: {
            description: '商务合作与专业咨询。',
            cta: '建立联系',
          },
          threads: {
            description: '社区讨论和轻量反馈。',
            cta: '加入讨论',
          },
        },
        resourcesList: {
          tutorial: '观看平台教程视频',
          community: '加入我们的 TikTok 社区获取更新',
        },
      },
    },
    tools: {
      index: {
        eyebrow: '工具',
        title: '营销工具箱',
        description: '面向营销执行和效果分析的轻量工具。',
        openTool: '打开工具',
        items: [
          {
            href: '/tools/upload-assets',
            title: '上传素材生成 URL',
            description: '上传图片或视频文件，并生成临时下载链接。',
          },
          {
            href: '/tools/roas-calculator',
            title: 'ROAS 计算器',
            description: '计算 ROAS、净利润、利润率和转化级广告表现。',
          },
          {
            href: '/tools/ai-angle-generator',
            title: 'AI 多角度照片',
            description: '上传一张正面照片，生成额外 3 个视角。',
          },
        ],
      },
      aiAngleGenerator: {
        eyebrow: '工具',
        title: 'AI 多角度照片',
        description: '上传一张正面照片，生成额外 3 个视角。支持产品、人物和宠物。',
        cardTitle: '生成 3 个额外角度',
        cardDescription:
          '上传 JPG 或 PNG 正面图（最小 300x300）。较大的图片会在上传前自动优化，以避免生产环境请求体超限。',
        selectImage: '选择正面图片',
        chooseImage: '选择图片',
        noImageSelected: '尚未选择图片',
        selectedFile: '已选文件',
        uploadingHelper: '正在优化、校验并上传你的图片...',
        generatingHelper: '正在保留原图风格生成 3 张角度图，最多可能需要 2 分钟。',
        signInAndRetry: '登录后重试',
        photoSetTitle: '图片结果集',
        photoSetDescription: '生成的角度图会尽量保持你的参考图风格，而不会切换成新的渲染风格。',
        copyUrl: '复制链接',
        copied: '已复制',
        download: '下载',
        styleAnchorDescription: '这张图片会作为所有生成视角图的风格锚点。',
        angleSlots: [
          {
            key: 'front_left_45',
            label: '左前 45°',
            description: '镜头位于主体左前方，左侧可见部分比右侧更多。',
          },
          {
            key: 'front_right_45',
            label: '右前 45°',
            description: '镜头位于主体右前方，右侧可见部分比左侧更多。',
          },
          {
            key: 'back_view',
            label: '背面视角',
            description: '补全背部视角，同时保持相同的材质、色调和整体画面氛围。',
          },
        ],
      },
    },
    featurePages: {
      aiAgent: {
        title: 'AI 智能体',
        description:
          '用画布模式搭建复刻工作流，把人物、产品、视频和功能拖进去，然后在一个清晰的可视化流程里直接启动生成。',
        primaryCta: '打开智能体',
        secondaryCta: '查看价格',
        mediaLabels: {
          referenceVideo: '参考视频',
          result: '智能体结果',
        },
        stepsEyebrow: '工作方式',
        stepsTitle: '在画布模式中搭建工作流',
        steps: [
          {
            title: '拖入你的素材',
            description: '把人物、产品和参考视频卡片拖到画布上，先把工作流结构搭好。',
          },
          {
            title: '拖入你需要的功能',
            description: '加入你需要的画布功能，不管是视频克隆、动作克隆，还是批量口播生成。',
          },
          {
            title: '点击开始运行',
            description: '当画布结构确认无误后，启动所选功能，让智能体接管后续流程。',
          },
        ],
        benefits: {
          workflow: {
            title: '在画布模式里搭建复刻工作流',
            bullets: [
              '拖动卡片重新组织流程，让每一步生成逻辑都一目了然。',
              '快速连接节点，适配视频克隆、动作克隆和动作变体工作流。',
              '在一个画布里批量生成口播产品视频和可投放的角色广告。',
            ],
          },
          naming: {
            title: '直接说出你要的素材，让画布自动连接它们',
            bullets: [
              '在聊天里提到具体人物、产品或参考视频，智能体就能把对应卡片放到画布上。',
              '把一句素材指令直接转成视频克隆、动作克隆或数字人口播结构，无需手动重搭。',
              '所有已选素材和连接关系都保留可见，后续修改只是在当前图上继续完善。',
            ],
          },
        },
        signup: {
          title: '准备开始你的第一个画布工作流了吗？',
          description: '创建账户后，就可以开始拖拽素材、功能和复刻流程。',
        },
      },
    },
    support: {
      backToHome: '返回首页',
      title: '支持与联系',
      description: '我们会协助你解决问题。选择最适合的渠道联系我们。TikTok 是我们回复最快的渠道。',
      priority: '优先',
      commonQuestions: '常见问题',
      questions: [
        {
          question: '如何开始使用？',
          answer: '点击“Get Started”注册，选择适合你的套餐，即可立即开始创建 AI 视频。',
        },
        {
          question: '支持哪些支付方式？',
          answer: '我们通过安全的支付处理服务支持主流信用卡、PayPal 以及多种其他支付方式。',
        },
        {
          question: '我可以升级或降级套餐吗？',
          answer: '我们提供一次性购买套餐。你也可以随时额外购买积分，以匹配你的需求。',
        },
        {
          question: '退款政策是什么？',
          answer: '如果你在购买过程中遇到问题或对结果不满意，请在 7 天内通过 TikTok 或邮件联系我们获取帮助。',
        },
      ],
      links: {
        tiktok: {
          description: '回复最快的渠道，通常 24 小时内答复。',
          cta: '发送私信',
        },
        discord: {
          description: '加入社区，获取实时帮助和讨论。',
          cta: '加入 Discord',
        },
        youtube: {
          description: '教程、功能更新与 AI 视频技巧。',
          cta: '观看教程',
        },
        email: {
          description: '适合详细咨询和账户支持。',
          cta: '发送邮件',
        },
        x: {
          description: '查看快速更新和产品动态。',
          cta: '关注',
        },
        instagram: {
          description: '查看视觉内容和幕后花絮。',
          cta: '查看主页',
        },
        linkedin: {
          description: '商务合作与专业咨询。',
          cta: '建立联系',
        },
        threads: {
          description: '社区讨论和轻量反馈。',
          cta: '加入讨论',
        },
      },
    },
    error: {
      title: '发生了意外错误',
      description: '抱歉，应用遇到了问题。我们已经记录此错误，并正在修复。',
      retry: '重试',
      backToHome: '返回首页',
      details: '显示错误详情（开发模式）',
    },
  },
};
