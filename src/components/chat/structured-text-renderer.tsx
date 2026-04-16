"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StructuredTextRendererProps = {
  text: string;
  inToolContext?: boolean;
};

type StructuredField = {
  label: string;
  value: string;
};

type ParsedSection =
  | {
      type: "card";
      title: string;
      subtitle?: string;
      fields: StructuredField[];
    }
  | {
      type: "heading";
      title: string;
      body?: string;
    }
  | {
      type: "markdown";
      content: string;
    };

const MARKDOWN_SYNTAX_RE = /(^|\n)(#{1,6}\s|[-*+]\s|>\s|\d+\.\s)|```|\|.+\|/m;

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold tracking-tight text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-6 text-foreground/90">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 pl-5 text-sm text-foreground/90">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1 pl-5 text-sm text-foreground/90">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-t border-border/60">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-sm text-foreground/90">{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl border border-border/60 bg-muted/50 p-3 text-xs text-foreground/90">
      {children}
    </pre>
  ),
  code: ({ children, ...props }: any) => {
    const className = String(props.className ?? "");
    const isBlock = className.includes("language-");

    if (isBlock) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground/90">
        {children}
      </code>
    );
  },
};

export function StructuredTextRenderer({
  text,
  inToolContext = false,
}: StructuredTextRendererProps) {
  const content = text.trim();
  if (!content) return null;

  const parsedSections = parseStructuredSections(content);
  const hasCards = parsedSections.some((section) => section.type === "card");

  if (hasCards) {
    return (
      <div className="space-y-3">
        {parsedSections.map((section, index) => {
          if (section.type === "card") {
            return (
              <Card key={`${section.title}-${index}`} className="border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  {section.subtitle ? (
                    <CardDescription className="text-[11px] uppercase tracking-wide">
                      {section.subtitle}
                    </CardDescription>
                  ) : null}
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.fields.map((field) => (
                    <div
                      key={`${section.title}-${field.label}`}
                      className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-xs"
                    >
                      <span className="font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </span>
                      <span className="leading-5 text-foreground/90">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          }

          if (section.type === "heading") {
            return (
              <div
                key={`${section.title}-${index}`}
                className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <p className="text-sm font-medium text-foreground">{section.title}</p>
                {section.body ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {section.body}
                  </p>
                ) : null}
              </div>
            );
          }

          return (
            <MarkdownBlock
              key={`${index}-${section.content.slice(0, 24)}`}
              text={section.content}
              inToolContext={inToolContext}
            />
          );
        })}
      </div>
    );
  }

  return <MarkdownBlock text={content} inToolContext={inToolContext} />;
}

function MarkdownBlock({
  text,
  inToolContext,
}: {
  text: string;
  inToolContext: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-3",
        inToolContext && "rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm"
      )}
    >
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function parseStructuredSections(text: string): ParsedSection[] {
  if (MARKDOWN_SYNTAX_RE.test(text)) {
    return [{ type: "markdown", content: text }];
  }

  const rawSections = text
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (rawSections.length === 0) {
    return [{ type: "markdown", content: text }];
  }

  const sections = rawSections.map(parseSection);
  const cardCount = sections.filter((section) => section.type === "card").length;

  if (cardCount === 0) {
    return [{ type: "markdown", content: text }];
  }

  return sections;
}

function parseSection(section: string): ParsedSection {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const titleLines: string[] = [];
  const fields: StructuredField[] = [];
  let currentField: StructuredField | null = null;

  for (const line of lines) {
    const fieldMatch = matchStructuredField(line);

    if (fieldMatch) {
      if (currentField) {
        fields.push(currentField);
      }
      currentField = fieldMatch;
      continue;
    }

    if (currentField) {
      currentField.value = currentField.value
        ? `${currentField.value} ${line}`
        : line;
    } else {
      titleLines.push(line);
    }
  }

  if (currentField) {
    fields.push(currentField);
  }

  if (fields.length >= 2) {
    const title = titleLines[titleLines.length - 1] ?? "Details";
    const subtitle =
      titleLines.length > 1 ? titleLines.slice(0, -1).join(" • ") : undefined;

    return {
      type: "card",
      title,
      subtitle,
      fields,
    };
  }

  if (lines.length <= 2) {
    return {
      type: "heading",
      title: lines[0] ?? section,
      body: lines[1],
    };
  }

  return {
    type: "markdown",
    content: section,
  };
}

function matchStructuredField(line: string): StructuredField | null {
  const match = line.match(/^([^:]{2,40}):\s*(.*)$/);
  if (!match) return null;

  const label = match[1].trim();
  if (label.split(/\s+/).length > 4) return null;
  if (!/[A-Za-z]/.test(label)) return null;

  return {
    label,
    value: match[2].trim(),
  };
}
