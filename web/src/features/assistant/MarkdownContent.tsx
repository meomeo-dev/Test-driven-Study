import type { ComponentPropsWithoutRef } from 'react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import './markdown.css';

function safeLink(value?: string) {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

function MarkdownLink({ href, children, title }: ComponentPropsWithoutRef<'a'>) {
  const url = safeLink(href);
  return url ? <a href={url} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>;
}

function MarkdownTable({ children }: ComponentPropsWithoutRef<'table'>) {
  return <div className="tutor-table-scroll" role="region" aria-label="对话表格" tabIndex={0}>
    <table>{children}</table>
  </div>;
}

const components = { a: MarkdownLink, table: MarkdownTable };
const plugins = [remarkGfm];
const blockedElements = ['img'];

export function MarkdownContent() {
  return <MarkdownTextPrimitive className="tutor-markdown" remarkPlugins={plugins}
    components={components} skipHtml disallowedElements={blockedElements}
    smooth={false} defer />;
}
