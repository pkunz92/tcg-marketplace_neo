import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPost } from '@/lib/blog'
import { ArrowLeft, Clock, User, Calendar } from 'lucide-react'

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Post Not Found' }

  return {
    title: `${post.title} | TCG Marketplace Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* MDX component overrides — maps to the dark design system */
const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="text-2xl font-bold text-slate-100 mt-10 mb-4 first:mt-0"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className="text-lg font-semibold text-slate-200 mt-6 mb-2" />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="text-slate-400 leading-relaxed mb-4" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="list-disc list-inside space-y-1.5 mb-4 text-slate-400" />
  ),
  ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="list-decimal list-inside space-y-1.5 mb-4 text-slate-400" />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="leading-relaxed" />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong {...props} className="text-slate-200 font-semibold" />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-6">
      <table
        {...props}
        className="w-full text-sm border-collapse bg-surface border border-border rounded-xl overflow-hidden"
      />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="border-b border-border" />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} className="px-4 py-2.5 text-slate-300 border-t border-border" />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLElement>) => (
    <blockquote
      {...props}
      className="border-l-2 border-accent-500/50 pl-4 my-4 text-slate-400 italic"
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      {...props}
      className="bg-elevated border border-border rounded px-1.5 py-0.5 text-xs font-mono text-accent-300"
    />
  ),
  hr: () => <hr className="my-8 border-border" />,
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.publishedAt,
    publisher: {
      '@type': 'Organization',
      name: 'TCG Marketplace',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-2xl mx-auto py-8 space-y-8">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-black text-slate-100 leading-tight">
            {post.title}
          </h1>
          <p className="text-lg text-slate-400">{post.description}</p>
          <div className="flex items-center gap-4 text-sm text-slate-500 border-t border-border pt-4">
            <span className="flex items-center gap-1.5">
              <User size={13} />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {post.readingTime} min read
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="prose-custom">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>

        {/* Footer */}
        <footer className="border-t border-border pt-8">
          <div className="bg-surface border border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-slate-300 font-semibold">Ready to buy or sell?</p>
            <p className="text-sm text-slate-500">
              Put this knowledge to work on TCG Marketplace.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/market"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-elevated px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:border-accent-500/40 transition-all"
              >
                Browse Market
              </Link>
              <Link
                href="/market/new"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent transition-all"
              >
                Sell a Card
              </Link>
            </div>
          </div>
        </footer>
      </article>
    </>
  )
}
