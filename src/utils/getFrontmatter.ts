import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function getFrontmatter(pathname: string) {
  try {
    // Convert URL path to file path
    // /reference/websocket-api/ -> src/content/docs/reference/websocket-api.md
    const cleanPath = pathname.replace(/^\//, '').replace(/\/$/, '');
    const filePath = path.join(process.cwd(), 'src/content/docs', `${cleanPath}.md`);

    if (!fs.existsSync(filePath)) {
      // Try with .mdx extension
      const mdxPath = filePath.replace('.md', '.mdx');
      if (fs.existsSync(mdxPath)) {
        const fileContent = fs.readFileSync(mdxPath, 'utf-8');
        const { data } = matter(fileContent);
        return data;
      }
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(fileContent);
    return data;
  } catch (error) {
    console.error('Error reading frontmatter:', error);
    return null;
  }
}
