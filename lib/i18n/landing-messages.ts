import type { SiteLocale } from '@/lib/i18n/site';

export type LandingMessages = {
  header: {
    features: string;
    tools: string;
    pricing: string;
    blog: string;
    faq: string;
    academy: string;
    dashboard: string;
    signUpDesktop: string;
    signUpMobile: string;
    themeToggleLabel: string;
    mainNavLabel: string;
    mobileMenuLabel: string;
    languageSwitcherLabel: string;
    localeOptions: {
      en: string;
      zh: string;
    };
    featureItems: Array<{
      href: string;
      title: string;
      isNew?: boolean;
    }>;
    toolItems: Array<{
      href: string;
      title: string;
    }>;
  };
  hero: {
    badges: {
      blackFriday: string;
      off: string;
      copy: string;
      copied: string;
      ends: string;
      discountCopied: string;
      codePrefix: string;
      klingLive: string;
      klingMotionLive: string;
      gptImage2Live: string;
    };
    shutdownNotice: {
      title: string;
      body: string;
    };
    title: string;
    titleHighlight: string;
    description: string;
    bullets: string[];
    tiktokInput: {
      placeholder: string;
      invalidUrl: string;
      signInRequired: string;
      analyze: string;
      analyzeAriaLabel: string;
      helpTitle: string;
      helpSteps: string[];
      helpNote: string;
    };
    discordJoin: string;
    discordTitle: string;
    socialProofLabel: string;
    socialProofTitle: string;
    socialProofSuffix: string;
    referenceVideo: string;
    cloneResult: string;
    referenceVideoAriaLabel: string;
    resultVideoAriaLabel: string;
    views: string;
  };
  features: {
    title: string;
    description: string;
    learnMore: string;
    newBadge: string;
    items: Array<{
      title: string;
      description: string;
      href: string;
      mediaLabels: string[];
      bullets: string[];
      isNew?: boolean;
    }>;
  };
  comparison: {
    title: string;
    description: string;
    platform: string;
    cost: string;
    included: string;
    bestValue: string;
    flowtraPrice: string;
    arcadsPrice: string;
    flowtraIncluded: string[];
    arcadsIncluded: string[];
  };
  modelPricing: {
    title: string;
    description: string;
    model: string;
    resolution: string;
    creditsPerSecond: string;
    generationCostPerSecond: string;
    comingSoon: string;
    free: string;
    newBadge: string;
  };
  pricing: {
    title: string;
    description: string;
    recommended: string;
    trial: string;
    trialBadge: string;
    perMonth: string;
    welcomeBonus: {
      title: string;
      descriptionBefore: string;
      descriptionAfter: string;
      features: string[];
      cta: string;
    };
    plans: {
      lite: {
        name: string;
        description: string;
      };
      basic: {
        name: string;
        description: string;
      };
      pro: {
        name: string;
        description: string;
      };
    };
    planFeatureItems: Record<'lite' | 'basic' | 'pro', string[]>;
    buttons: {
      loading: string;
      getStarted: string;
      alreadySubscribed: string;
      processing: string;
      changePlan: string;
      emailRequired: string;
      purchaseFailed: string;
      unexpectedError: string;
      planChangeConfirm: (currentTier: string, newTier: string) => string;
    };
  };
  blogPreview: {
    title: string;
    description: string;
    viewAll: string;
    noImage: string;
    readMore: string;
    fetchFailed: string;
  };
  faq: {
    title: string;
    description: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  footer: {
    aboutTitle: string;
    description: string;
    rightsReserved: string;
    features: string;
    resources: string;
    tools: string;
    socialProof: string;
    contact: string;
    legal: string;
    blog: string;
    terms: string;
    privacy: string;
    newBadge: string;
    disclaimer: string;
    transparency: string;
    featureItems: Array<{
      href: string;
      label: string;
      isNew?: boolean;
    }>;
    toolItems: Array<{
      href: string;
      label: string;
    }>;
  };
};

export const landingMessages: Record<SiteLocale, LandingMessages> = {
  en: {
    header: {
      features: 'Features',
      tools: 'Tools',
      pricing: 'Pricing',
      blog: 'Blog',
      faq: 'FAQ',
      academy: 'Academy',
      dashboard: 'Dashboard',
      signUpDesktop: 'Sign up · Get 100 free credits',
      signUpMobile: 'Get 100 Credits',
      themeToggleLabel: 'Toggle light and dark mode',
      mainNavLabel: 'Main navigation',
      mobileMenuLabel: 'Toggle mobile menu',
      languageSwitcherLabel: 'Landing page language',
      localeOptions: {
        en: 'EN',
        zh: '中文',
      },
      featureItems: [
        { href: '/features/ai-agent', title: 'AI Agent', isNew: true },
        { href: '/features/avatar-ads', title: 'Avatar Ads' },
        { href: '/features/video-clone', title: 'Video Clone' },
        { href: '/features/motion-clone', title: 'Motion Clone' },
      ],
      toolItems: [
        { href: '/tools/upload-assets', title: 'Upload Assets to URL' },
        { href: '/tools/roas-calculator', title: 'ROAS Calculator' },
        { href: '/tools/ai-angle-generator', title: 'Multi-Angle Photo' },
        { href: '/tools/image-clone', title: 'Image Clone' },
      ],
    },
    hero: {
      badges: {
        blackFriday: 'Black Friday',
        off: '20% OFF',
        copy: 'Copy',
        copied: 'Copied!',
        ends: 'Ends',
        discountCopied: 'Discount code copied!',
        codePrefix: 'Code: ',
        klingLive: 'Seedance 2 is live',
        klingMotionLive: 'Kling 3.0 is live',
        gptImage2Live: 'ChatGPT image 2 is live',
      },
      shutdownNotice: {
        title: 'Important notice for Flowtra subscribers and customers',
        body: 'Due to the project not having stable revenue for an extended period, and the founder no longer being able to cover fixed monthly costs such as servers, Flowtra is expected to shut down in about 1-2 weeks. All credits will remain available until the final moment.',
      },
      title: 'Turn Viral Videos Into Your Own',
      titleHighlight: 'Viral Videos',
      description: 'For TikTok dropshipping, small businesses, and local stores.',
      bullets: [
        'Clone viral TikTok UGC in minutes',
        'Swap products, brands, or pets with your own',
        'Videos from $2.25 per minute (150x cheaper than hiring UGC creators)',
        'Supports English, Spanish, and over 10 other languages',
      ],
      tiktokInput: {
        placeholder: 'Paste TikTok URL...',
        invalidUrl: 'Please enter a valid TikTok video URL',
        signInRequired: 'Sign in to analyze TikTok videos.',
        analyze: 'Analyze',
        analyzeAriaLabel: 'Analyze TikTok Video',
        helpTitle: 'How to get a video URL:',
        helpSteps: [
          'Find a video on TikTok web',
          'Copy the URL from browser address bar',
        ],
        helpNote: 'TikTok Shop product links are not supported (e.g. vm.tiktok.com/...).',
      },
      discordJoin: 'Join',
      discordTitle: 'Join our Discord community',
      socialProofLabel: 'Social proof',
      socialProofTitle: 'small business owners trust Flowtra',
      socialProofSuffix: 'small business owners',
      referenceVideo: 'Viral Video',
      cloneResult: 'Clone Result',
      referenceVideoAriaLabel: 'Reference video example',
      resultVideoAriaLabel: 'AI generated result video',
      views: 'Views',
    },
    features: {
      title: 'Explore Our Features',
      description: 'Powerful AI tools to transform your product images into professional marketing content',
      learnMore: 'Learn More',
      newBadge: 'New',
      items: [
        {
          title: 'AI Agent',
          description: 'Build clone workflows in canvas mode with drag-and-drop assets, quick node linking, and support for video clone, motion clone, and talking-head generation.',
          href: '/features/ai-agent',
          mediaLabels: ['Reference Video', 'Agent Result'],
          bullets: [
            'Drag people, products, and videos into one canvas',
            'Connect functions fast with clear visual links',
            'Run video clone, motion clone, and talking-head flows from one workspace',
            'Keep asset swaps visible and explicit in your workflow',
          ],
          isNew: true,
        },
        {
          title: 'Video Clone',
          description: 'Clone top-performing viral videos with AI. Clone proven creative structures in minutes.',
          href: '/features/video-clone',
          mediaLabels: ['Viral Video', 'Clone'],
          bullets: [
            'Max 60 seconds',
            'Supports custom editing',
            'Replace your products, brand, or pets',
            'Supports English, Spanish, and 10+ languages',
          ],
        },
        {
          title: 'Avatar Ads',
          description: 'Create avatar-driven video advertisements with realistic AI characters powered by Seedance 2 Fast.',
          href: '/features/avatar-ads',
          mediaLabels: [],
          bullets: [
            '33 credits per second',
            'Supports English, Spanish, and 10+ languages',
            'Generate up to 80 seconds',
            'Supports custom scripts',
            'Unlimited character uploads',
          ],
        },
        {
          title: 'Motion Clone',
          description: "Clone viral ads in seconds. Enter a creator's name and place your product into the motion while preserving the exact movements.",
          href: '/features/motion-clone',
          mediaLabels: ['Original Creator', 'Motion Clone'],
          bullets: [
            'One-click creator search',
            'Motion preservation technology',
            'Smart first frame editing',
            'Higher success rate with visual preview',
          ],
        },
      ],
    },
    comparison: {
      title: 'Arcads Alternative',
      description: 'Discover a superior alternative for your video generation needs',
      platform: 'Platform',
      cost: 'Cost',
      included: 'Included',
      bestValue: 'Best Value',
      flowtraPrice: 'Basic $59/mo',
      arcadsPrice: 'Creator $220/mo',
      flowtraIncluded: [
        '3,930 credits',
        'Avatar Ads',
        'Clone viral videos',
        'Motion Clone',
        '10+ languages',
        'Latest video models',
      ],
      arcadsIncluded: [
        '20 credits per month',
        '300 Natural AI Actors',
        'Use 35 languages',
        'Delivered in 2 minutes',
        'Play videos up to 120 sec',
      ],
    },
    modelPricing: {
      title: 'Price details',
      description: 'Transparent pricing for all models. Choose the right model for your needs.',
      model: 'Model',
      resolution: 'Resolution',
      creditsPerSecond: 'Credits / Sec',
      generationCostPerSecond: 'Generation Cost / Sec',
      comingSoon: 'Coming soon',
      free: 'Free',
      newBadge: 'New',
    },
    pricing: {
      title: 'Choose Your Plan',
      description: 'Monthly subscription with automatic credit reset',
      recommended: 'Recommended',
      trial: '1 Day Free Trial',
      trialBadge: 'Trial',
      perMonth: '/month',
      welcomeBonus: {
        title: 'Welcome Bonus',
        descriptionBefore: 'Congratulations. You received ',
        descriptionAfter: ' credits.',
        features: [
          'AI Agent',
          'Avatar Ads',
          'Clone viral video',
          'Motion Clone',
          'Unlimited product configuration',
          'Unlimited character configuration',
          'Import TikTok videos',
        ],
        cta: 'Enter Console',
      },
      plans: {
        lite: {
          name: 'Lite',
          description: 'Perfect for small creators starting out.',
        },
        basic: {
          name: 'Basic',
          description: 'Most popular for growing brands.',
        },
        pro: {
          name: 'Pro',
          description: 'For power users and agencies.',
        },
      },
      planFeatureItems: {
        lite: [
          '1,930 Credits',
          'AI Agent',
          'Avatar Ads',
          'Clone viral videos',
          'Motion Clone',
          '10+ languages',
          'Latest video models',
          'TikTok publishing support',
        ],
        basic: [
          '3,930 Credits',
          'AI Agent',
          'Avatar Ads',
          'Clone viral videos',
          'Motion Clone',
          '10+ languages',
          'Latest video models',
          'TikTok publishing support',
        ],
        pro: [
          '6,600 Credits',
          'AI Agent',
          'Avatar Ads',
          'Clone viral videos',
          'Motion Clone',
          '10+ languages',
          'Latest video models',
          'TikTok publishing support',
        ],
      },
      buttons: {
        loading: 'Loading...',
        getStarted: 'Get Started',
        alreadySubscribed: 'Already Subscribed',
        processing: 'Processing...',
        changePlan: 'Change Plan',
        emailRequired: 'Email address is required for purchase. Please check your account settings.',
        purchaseFailed: 'Purchase failed: ',
        unexpectedError: 'An unexpected error occurred. Please try again.',
        planChangeConfirm: (currentTier: string, newTier: string) =>
          `You are currently subscribed to the ${currentTier} plan. This will create a new ${newTier} subscription. Please cancel your existing subscription in your account settings first.`,
      },
    },
    blogPreview: {
      title: 'From the Blog',
      description: 'Latest tips and case studies about AI ads',
      viewAll: 'View all',
      noImage: 'No Image',
      readMore: 'Read More',
      fetchFailed: 'Failed to fetch article previews',
    },
    faq: {
      title: 'Frequently Asked Questions',
      description: 'Answers for TikTok dropshippers using Flowtra to launch viral UGC ads fast',
      items: [
        {
          question: 'What is Flowtra, and how does it help TikTok dropshippers?',
          answer: 'Flowtra helps TikTok dropshippers turn product photos and reference videos into scroll-stopping UGC ads in minutes. Use Video Clone, Avatar Ads, or Motion Clone to ship new creatives fast without a full production team.',
        },
        {
          question: 'I’m not a video editor. Can I still use Flowtra?',
          answer: 'Yes. Flowtra is built for non-editors. Upload your product image or a viral reference, pick a style, and click “Generate.”',
        },
        {
          question: 'How does pricing work?',
          answer: 'Flowtra uses monthly subscriptions with credits. Credits are deducted when you generate videos. Image generation is free, so you can test looks before spending credits.',
        },
        {
          question: 'Can I clone viral TikTok ads for my products?',
          answer: 'Yes. Video Clone lets you upload a reference TikTok video and recreate the structure with your product, so you can launch new ads fast.',
        },
        {
          question: 'Can I use the videos commercially?',
          answer: 'Yes. Everything you generate is yours to use for ads, product pages, and paid campaigns. No watermarks or extra licensing fees.',
        },
      ],
    },
    footer: {
      aboutTitle: 'About Flowtra',
      description: 'AI ads for Shopify, dropshipping, content creator, and local stores.',
      rightsReserved: 'All rights reserved.',
      features: 'Features',
      resources: 'Resources',
      tools: 'Tools',
      socialProof: 'Social Proof',
      contact: 'Contact',
      legal: 'Legal',
      blog: 'Blog',
      terms: 'Terms of Use',
      privacy: 'Privacy Policy',
      newBadge: 'New',
      disclaimer: 'Flowtra is an independent creative platform and is not affiliated with or endorsed by any model creators.',
      transparency: 'Flowtra provides an independent workflow interface powered by third-party AI models.',
      featureItems: [
        { href: '/features/ai-agent', label: 'AI Agent', isNew: true },
        { href: '/features/avatar-ads', label: 'Avatar Ads' },
        { href: '/features/video-clone', label: 'Video Clone' },
        { href: '/features/motion-clone', label: 'Motion Clone' },
      ],
      toolItems: [
        { href: '/tools/upload-assets', label: 'Upload Assets to URL' },
        { href: '/tools/roas-calculator', label: 'ROAS Calculator' },
        { href: '/tools/ai-angle-generator', label: 'Multi-Angle Photo' },
        { href: '/tools/image-clone', label: 'Image Clone' },
      ],
    },
  },
  zh: {
    header: {
      features: '功能',
      tools: '工具',
      pricing: '价格',
      blog: '博客',
      faq: '常见问题',
      academy: 'Academy',
      dashboard: '控制台',
      signUpDesktop: '注册 · 获得 100 免费积分',
      signUpMobile: '领取 100 积分',
      themeToggleLabel: '切换明暗主题',
      mainNavLabel: '主导航',
      mobileMenuLabel: '切换移动端菜单',
      languageSwitcherLabel: '落地页语言',
      localeOptions: {
        en: 'EN',
        zh: '中文',
      },
      featureItems: [
        { href: '/features/ai-agent', title: 'AI 智能体', isNew: true },
        { href: '/features/avatar-ads', title: '数字人广告' },
        { href: '/features/video-clone', title: '爆款复刻' },
        { href: '/features/motion-clone', title: '动作复刻' },
      ],
      toolItems: [
        { href: '/tools/upload-assets', title: '上传素材转链接' },
        { href: '/tools/roas-calculator', title: 'ROAS 计算器' },
        { href: '/tools/ai-angle-generator', title: 'AI 多角度图片' },
        { href: '/tools/image-clone', title: '图片复刻' },
      ],
    },
    hero: {
      badges: {
        blackFriday: '黑五活动',
        off: '立减 20%',
        copy: '复制',
        copied: '已复制',
        ends: '结束于',
        discountCopied: '优惠码已复制！',
        codePrefix: '优惠码：',
        klingLive: 'Seedance 2 已上线',
        klingMotionLive: 'Kling 3.0 已上线',
        gptImage2Live: 'ChatGPT image 2 已上线',
      },
      shutdownNotice: {
        title: '致 Flowtra 订阅或购买过套餐的用户',
        body: '你好。由于本项目长时间没有稳定收入，加之创始人本人无法负担项目每个月固定的服务器等成本，项目预计会在约 1-2 周内关停。请你知悉，所有积分会保留到最后一刻。',
      },
      title: '把爆款视频变成你的专属素材',
      titleHighlight: '爆款视频',
      description: '适用于 TikTok dropshipping、小型品牌商家与本地门店。',
      bullets: [
        '几分钟内复刻 TikTok 爆款 UGC',
        '支持替换品牌、产品，甚至宠物',
        '视频最低每分钟约 $2.25（比请 UGC 创作者便宜 150 倍）',
        '支持英文、西班牙语及 10 多种语言',
      ],
      tiktokInput: {
        placeholder: '粘贴 TikTok 视频链接...',
        invalidUrl: '请输入有效的 TikTok 视频链接',
        signInRequired: '请先登录后再分析 TikTok 视频。',
        analyze: '分析',
        analyzeAriaLabel: '分析 TikTok 视频',
        helpTitle: '如何获取视频链接：',
        helpSteps: [
          '在 TikTok 网页端打开视频',
          '从浏览器地址栏复制链接',
        ],
        helpNote: '暂不支持 TikTok Shop 商品链接（例如 vm.tiktok.com/...）。',
      },
      discordJoin: '加入',
      discordTitle: '加入我们的 Discord 社区',
      socialProofLabel: '社交背书',
      socialProofTitle: '位小商家正在使用 Flowtra',
      socialProofSuffix: '位小商家',
      referenceVideo: '爆款视频',
      cloneResult: '复刻结果',
      referenceVideoAriaLabel: '视频克隆参考视频',
      resultVideoAriaLabel: 'AI 生成结果视频',
      views: '播放量',
    },
    features: {
      title: '探索我们的功能',
      description: '用强大的 AI 工具，把产品图片快速变成专业营销素材',
      learnMore: '了解更多',
      newBadge: '新',
      items: [
        {
          title: 'AI 智能体',
          description: '在画布模式里搭建复刻工作流，支持拖拽素材、快速连线，并一站式完成视频复刻、动作复刻与口播生成。',
          href: '/features/ai-agent',
          mediaLabels: ['参考视频', '智能体结果'],
          bullets: [
            '把人物、产品和视频拖到同一张画布上',
            '用清晰的可视化连线快速连接功能节点',
            '在同一工作区运行视频复刻、动作复刻与口播流程',
            '素材替换清晰可见，直接呈现在工作流中',
          ],
          isNew: true,
        },
        {
          title: '爆款复刻',
          description: '用 AI 复刻高表现的爆款视频结构，几分钟内生成经过验证的创意版本。',
          href: '/features/video-clone',
          mediaLabels: ['爆款视频', '复刻效果'],
          bullets: [
            '最长支持 60 秒',
            '支持自定义编辑',
            '可替换成你的产品、品牌或宠物',
            '支持英文、西班牙语及 10 多种语言',
          ],
        },
        {
          title: '数字人广告',
          description: '用 Seedance 2 Fast 驱动真实感 AI 数字人，生成可直接投放的视频广告。',
          href: '/features/avatar-ads',
          mediaLabels: [],
          bullets: [
            '每秒仅需 33 积分',
            '支持英文、西班牙语及 10 多种语言',
            '最长可生成 80 秒',
            '支持自定义脚本',
            '支持无限上传数字人素材',
          ],
        },
        {
          title: '动作复刻',
          description: '几秒内复刻爆款广告动作。输入创作者名称，即可在保留原始动作的同时将你的产品融入场景。',
          href: '/features/motion-clone',
          mediaLabels: ['原始创作者', '动作复刻'],
          bullets: [
            '一键搜索创作者',
            '动作保留技术',
            '智能首帧编辑',
            '可视化预览带来更高成功率',
          ],
        },
      ],
    },
    comparison: {
      title: 'Arcads 替代方案',
      description: '了解一个更强、更划算的视频生成选择',
      platform: '平台',
      cost: '价格',
      included: '包含内容',
      bestValue: '最划算',
      flowtraPrice: 'Basic $59/月',
      arcadsPrice: 'Creator $220/月',
      flowtraIncluded: [
        '3,930 积分',
        '数字人广告',
        '爆款视频复刻',
        '动作复刻',
        '支持 10+ 语言',
        '最新视频模型',
      ],
      arcadsIncluded: [
        '每月 20 积分',
        '300 个自然 AI 演员',
        '支持 35 种语言',
        '2 分钟交付',
        '视频最长 120 秒',
      ],
    },
    modelPricing: {
      title: '模型价格明细',
      description: '所有模型定价透明，按需求选择最适合的模型。',
      model: '模型',
      resolution: '分辨率',
      creditsPerSecond: '积分 / 秒',
      generationCostPerSecond: '生成成本 / 秒',
      comingSoon: '即将上线',
      free: '免费',
      newBadge: '新',
    },
    pricing: {
      title: '选择你的方案',
      description: '按月订阅，积分自动重置',
      recommended: '推荐',
      trial: '1 天免费试用',
      trialBadge: '试用',
      perMonth: '/月',
      welcomeBonus: {
        title: '欢迎奖励',
        descriptionBefore: '恭喜，你已获得 ',
        descriptionAfter: ' 积分。',
        features: [
          'AI 智能体',
          '数字人广告',
          '爆款视频复刻',
          '动作复刻',
          '无限产品配置',
          '无限角色配置',
          '导入 TikTok 视频',
        ],
        cta: '进入控制台',
      },
      plans: {
        lite: {
          name: 'Lite',
          description: '适合刚开始尝试的小型创作者。',
        },
        basic: {
          name: 'Basic',
          description: '最适合成长中的品牌。',
        },
        pro: {
          name: 'Pro',
          description: '适合重度用户与代理团队。',
        },
      },
      planFeatureItems: {
        lite: [
          '1,930 积分',
          'AI 智能体',
          '数字人广告',
          '爆款视频复刻',
          '动作复刻',
          '支持 10+ 语言',
          '最新视频模型',
          '支持发布到 TikTok',
        ],
        basic: [
          '3,930 积分',
          'AI 智能体',
          '数字人广告',
          '爆款视频复刻',
          '动作复刻',
          '支持 10+ 语言',
          '最新视频模型',
          '支持发布到 TikTok',
        ],
        pro: [
          '6,600 积分',
          'AI 智能体',
          '数字人广告',
          '爆款视频复刻',
          '动作复刻',
          '支持 10+ 语言',
          '最新视频模型',
          '支持发布到 TikTok',
        ],
      },
      buttons: {
        loading: '加载中...',
        getStarted: '立即开始',
        alreadySubscribed: '当前方案已订阅',
        processing: '处理中...',
        changePlan: '切换方案',
        emailRequired: '购买需要邮箱地址，请检查你的账号设置。',
        purchaseFailed: '购买失败：',
        unexpectedError: '发生意外错误，请稍后重试。',
        planChangeConfirm: (currentTier: string, newTier: string) =>
          `你当前订阅的是 ${currentTier} 方案。继续后会创建新的 ${newTier} 订阅。请先在账号设置中取消当前订阅。`,
      },
    },
    blogPreview: {
      title: '博客精选',
      description: '最新 AI 广告技巧与案例分析',
      viewAll: '查看全部',
      noImage: '暂无图片',
      readMore: '继续阅读',
      fetchFailed: '获取文章预览失败',
    },
    faq: {
      title: '常见问题',
      description: '为想快速上线爆款 UGC 广告的 TikTok dropshipper 提供解答',
      items: [
        {
          question: 'Flowtra 是什么？它如何帮助 TikTok dropshipper？',
          answer: 'Flowtra 可以帮助 TikTok dropshipper 将产品图片和爆款参考视频，快速转成吸睛的 UGC 广告。你可以使用爆款复刻、数字人广告或动作复刻，在没有完整制作团队的情况下快速上线新素材。',
        },
        {
          question: '我不是视频编辑，也能使用 Flowtra 吗？',
          answer: '可以。Flowtra 就是为非专业剪辑用户设计的。上传产品图或爆款参考素材，选择风格，然后点击“生成”即可。',
        },
        {
          question: '价格是如何计算的？',
          answer: 'Flowtra 采用按月订阅加积分模式。生成视频时才会扣除积分。图片生成免费，所以你可以在花积分前先测试画面风格。',
        },
        {
          question: '我可以把 TikTok 爆款广告复刻成自己的产品视频吗？',
          answer: '可以。爆款复刻支持上传 TikTok 爆款视频，并用你的产品重建相同结构，帮助你快速上线新广告。',
        },
        {
          question: '生成的视频可以商用吗？',
          answer: '可以。你生成的所有内容都可用于广告、商品页和付费投放，不会有水印，也不需要额外授权费。',
        },
      ],
    },
    footer: {
      aboutTitle: '关于 Flowtra',
      description: '为 Shopify、dropshipping、内容创作者和本地门店打造的 AI 广告工具。',
      rightsReserved: '保留所有权利。',
      features: '功能',
      resources: '资源',
      tools: '工具',
      socialProof: '社交背书',
      contact: '联系我们',
      legal: '法律信息',
      blog: '博客',
      terms: '使用条款',
      privacy: '隐私政策',
      newBadge: '新',
      disclaimer: 'Flowtra 是独立的创意平台，与任何模型创作者均无关联，亦未获得其背书。',
      transparency: 'Flowtra 提供基于第三方 AI 模型的独立工作流界面。',
      featureItems: [
        { href: '/features/ai-agent', label: 'AI 智能体', isNew: true },
        { href: '/features/avatar-ads', label: '数字人广告' },
        { href: '/features/video-clone', label: '爆款复刻' },
        { href: '/features/motion-clone', label: '动作复刻' },
      ],
      toolItems: [
        { href: '/tools/upload-assets', label: '上传素材转链接' },
        { href: '/tools/roas-calculator', label: 'ROAS 计算器' },
        { href: '/tools/ai-angle-generator', label: 'AI 多角度图片' },
        { href: '/tools/image-clone', label: '图片复刻' },
      ],
    },
  },
};
