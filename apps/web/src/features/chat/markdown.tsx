import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Jawaban Otak Sparta berupa markdown (daftar, tabel, kode). Gaya dibuat
// manual supaya sama dengan skala teks Sparta, tanpa plugin typography.
function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p {...props} />,
          ul: (props) => (
            <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
          ),
          ol: (props) => (
            <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
          ),
          h1: (props) => <h3 className="text-base font-semibold" {...props} />,
          h2: (props) => <h3 className="text-base font-semibold" {...props} />,
          h3: (props) => <h4 className="text-sm font-semibold" {...props} />,
          a: (props) => (
            <a
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-lg bg-muted p-3 text-xs"
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b bg-muted/60 px-3 py-2 font-semibold"
              {...props}
            />
          ),
          td: (props) => (
            <td className="border-b px-3 py-2 align-top" {...props} />
          ),
          hr: () => <hr className="border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export { Markdown }
