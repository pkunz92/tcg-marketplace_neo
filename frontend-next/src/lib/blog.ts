import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'src', 'content', 'blog')

export interface PostFrontmatter {
  title: string
  description: string
  author: string
  publishedAt: string
  coverImage?: string
  tags?: string[]
}

export interface PostMeta extends PostFrontmatter {
  slug: string
  readingTime: number
}

export interface Post extends PostMeta {
  content: string
}

function calcReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))
  return files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '')
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8')
      const { data, content } = matter(raw)
      const frontmatter = data as PostFrontmatter
      return {
        slug,
        ...frontmatter,
        readingTime: calcReadingTime(content),
      }
    })
    .sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1))
}

export function getPost(slug: string): Post | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  const frontmatter = data as PostFrontmatter
  return {
    slug,
    ...frontmatter,
    readingTime: calcReadingTime(content),
    content,
  }
}
