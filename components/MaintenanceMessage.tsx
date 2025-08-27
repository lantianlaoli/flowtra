'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';

interface MaintenanceMessageProps {
  message?: string;
}

export default function MaintenanceMessage({ message }: MaintenanceMessageProps) {
  const contactLinks = [
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: '𝕏'
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: '💼'
    },
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: '🎵'
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: '🧵'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-8">
        <div className="text-center space-y-6">
          {/* Maintenance icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-4 border-orange-200">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
          
          {/* Maintenance message */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              服务器维护中
            </h3>
            <p className="text-gray-700 text-base leading-relaxed mb-6">
              {message || '系统正在进行维护升级，暂时无法处理新的请求。我们正在努力尽快恢复服务，请稍后再试。'}
            </p>
            <div className="bg-white/60 rounded-lg p-4 border border-orange-200/50 mb-6">
              <p className="text-sm text-gray-600">
                <strong>预计恢复时间：</strong>通常维护会在 30 分钟内完成
              </p>
            </div>
          </div>
          
          {/* Contact information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              如有紧急需求，请联系客服：
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {contactLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-300 shadow-sm"
                >
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-sm">{link.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Additional help */}
          <div className="pt-4 border-t border-orange-200">
            <p className="text-sm text-gray-600">
              感谢您的耐心等待。我们会及时更新维护进度。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}