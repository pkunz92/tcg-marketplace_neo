import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'
import { Clock, User, Tag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog | TCG Marketplace',
  description:
    'Tips, guides, and market insights for Pokémon TCG collectors and sellers. Card grading, pricing strategies, and market trends.',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      {/* Hero */}
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/10 border border-accent-500/20 px-4 py-1.5 text-sm text-accent-400 font-medium">
          Blog
        </div>
        <h1 className="text-4xl font-black text-slate-100">
          Collector&apos;s <span className="gradient-text">Knowledge Base</span>
        </h1>
        <p className="text-slate-400">
          Guides, tips, and market insights for Pokémon TCG collectors and sellers.
        </p>
      </section>

      {/* Posts */}
      <section className="space-y-5">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block bg-surface border border-border rounded-2xl p-6 hover:border-accent-500/40 transition-all group"
          >
            <div className="space-y-3">
              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2 py-0.5 rounded-full"
                    >
                      <Tag size={9} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h2 className="text-xl font-bold text-slate-100 group-hover:text-accent-300 transition-colors">
                {post.title}
              </h2>

              {/* Description */}
              <p className="text-slate-400 text-sm leading-relaxed">{post.description}</p>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <User size={11} />
                  {post.author}
                </span>
                <span>{formatDate(post.publishedAt)}</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={11} />
                  {post.readingTime} min read
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
