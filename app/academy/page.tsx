'use client';

import Header from '@/components/layout/Header';
import { useI18n } from '@/providers/I18nProvider';
import { ArrowUpRight, BookOpen, PlayCircle } from 'lucide-react';

const YOUTUBE_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLGkWBBjN3soi9XDRMsTW2YH4SZFB1IXoI&si=5-EK9eBuWdQbWYdA';
const YOUTUBE_PLAYLIST_EMBED_URL = 'https://www.youtube.com/embed/videoseries?list=PLGkWBBjN3soi9XDRMsTW2YH4SZFB1IXoI';
const CHINESE_ACADEMY_VIDEOS = [
  {
    id: 'BV1rySoBpEwS',
    title: '泡泡机带货视频克隆',
    pageUrl: 'https://www.bilibili.com/video/BV1rySoBpEwS/',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1rySoBpEwS&page=1',
  },
  {
    id: 'BV1zWDjBBEEE',
    title: '拳击手靶超长口播带货',
    pageUrl: 'https://www.bilibili.com/video/BV1zWDjBBEEE/',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1zWDjBBEEE&page=1',
  },
] as const;

export default function AcademyPage() {
  const { locale, messages } = useI18n();
  const academyMessages = messages.academy;
  const isChinese = locale === 'zh';

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-[90rem] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <div className="mb-10 rounded-[32px] border border-[#E5E5E5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8F8F6_100%)] px-6 py-10 shadow-[0_24px_70px_rgba(0,0,0,0.05)] sm:px-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#666666]">
              <BookOpen className="h-4 w-4 text-black" />
              {academyMessages.eyebrow}
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-black sm:text-5xl">
              {academyMessages.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#666666] sm:text-lg">
              {academyMessages.description}
            </p>
          </div>

          {isChinese ? (
            <section className="rounded-[30px] border border-[#E5E5E5] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:p-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-2 text-[12px] font-medium text-black">
                <PlayCircle className="h-4 w-4" />
                {academyMessages.localeBadgeBilibili}
              </div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-black">
                    {academyMessages.bilibiliTitle}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[#666666]">
                    {academyMessages.bilibiliDescription}
                  </p>
                </div>
                <a
                  href={CHINESE_ACADEMY_VIDEOS[0].pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-press-button inline-flex items-center gap-2"
                  aria-label={academyMessages.openExternal}
                >
                  {academyMessages.watchOnBilibili}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {CHINESE_ACADEMY_VIDEOS.map((video) => (
                  <div key={video.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[#666666]">{video.title}</div>
                      <a
                        href={video.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-black transition-opacity hover:opacity-70"
                        aria-label={academyMessages.openExternal}
                      >
                        {academyMessages.watchOnBilibili}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="relative w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F7F7F7]" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={video.embedUrl}
                        title={`${academyMessages.bilibiliTitle} ${video.title}`}
                        className="absolute inset-0 h-full w-full"
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[30px] border border-[#E5E5E5] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:p-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-2 text-[12px] font-medium text-black">
                <PlayCircle className="h-4 w-4" />
                {academyMessages.localeBadgeYoutube}
              </div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-black">
                    {academyMessages.playlistTitle}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[#666666]">
                    {academyMessages.playlistDescription}
                  </p>
                </div>
                <a
                  href={YOUTUBE_PLAYLIST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-press-button inline-flex items-center gap-2"
                  aria-label={academyMessages.openExternal}
                >
                  {academyMessages.watchOnYoutube}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="relative w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F7F7F7]" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={YOUTUBE_PLAYLIST_EMBED_URL}
                  title={academyMessages.playlistTitle}
                  className="absolute inset-0 h-full w-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
