import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useState, useRef } from 'react';

const lowlight = createLowlight(common);

const LANGUAGES = [
  { value: 'plaintext', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
];

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' || url.protocol === 'ftp:';
  } catch (_) {
    return false;
  }
}

function CodeBlockView({ node, updateAttributes, extension }) {
  const codeRef = useRef(null);
  const [language, setLanguage] = useState(node.attrs.language || 'plaintext');

  useEffect(() => {
    if (codeRef.current && node.attrs.language) {
      codeRef.current.className = `language-${node.attrs.language}`;
    }
  }, [node.attrs.language]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    updateAttributes({ language: newLang });
  };

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header">
        <select
          contentEditable={false}
          className="code-block-language-select"
          value={language}
          onChange={handleLanguageChange}
        >
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <pre className={`code-block-pre language-${language}`}>
        <code ref={codeRef} className={`language-${language}`}>
          <NodeViewContent as="span" />
        </code>
      </pre>
    </NodeViewWrapper>
  );
}

function ToolbarButton({ onClick, disabled, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`toolbar-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = '请输入文章内容...' }) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkError, setLinkError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'article-link',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block',
        },
        addNodeView() {
          return ({ node, updateAttributes, extension }) => {
            return {
              component: CodeBlockView,
              props: {
                node,
                updateAttributes,
                extension,
              },
            };
          };
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none rich-editor-content',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const url = linkInputValue.trim();

    if (!url) {
      setLinkError('链接地址不能为空');
      return;
    }

    if (!isValidUrl(url)) {
      setLinkError('请输入合法的链接地址（需包含 http:// 或 https:// 等协议）');
      return;
    }

    setLinkError('');

    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();

    setShowLinkInput(false);
    setLinkInputValue('');
  };

  const toggleLinkInput = () => {
    if (editor.isActive('link')) {
      const attrs = editor.getAttributes('link');
      setLinkInputValue(attrs.href || '');
    } else {
      setLinkInputValue('');
    }
    setLinkError('');
    setShowLinkInput(!showLinkInput);
  };

  return (
    <div className="rich-text-editor">
      <div className="editor-toolbar">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().toggleBold()}
          active={editor.isActive('bold')}
          title="加粗 (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().toggleItalic()}
          active={editor.isActive('italic')}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().toggleStrike()}
          active={editor.isActive('strike')}
          title="删除线"
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().toggleCode()}
          active={editor.isActive('code')}
          title="行内代码"
        >
          {'</>'}
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="一级标题"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="二级标题"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="三级标题"
        >
          H3
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="无序列表"
        >
          • 列表
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="有序列表"
        >
          1. 列表
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="引用"
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="代码块"
        >
          {'{ }'}
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton
          onClick={toggleLinkInput}
          active={editor.isActive('link')}
          title="插入链接"
        >
          🔗
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做 (Ctrl+Y)"
        >
          ↷
        </ToolbarButton>
      </div>

      {showLinkInput && (
        <div className="link-input-bar">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              type="url"
              className={`link-input ${linkError ? 'has-error' : ''}`}
              placeholder="请输入链接地址，如 https://example.com"
              value={linkInputValue}
              onChange={(e) => {
                setLinkInputValue(e.target.value);
                if (linkError) setLinkError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                }
              }}
              autoFocus
            />
            {linkError && <div className="link-error-text">{linkError}</div>}
          </div>
          <button type="button" className="btn btn-primary link-btn" onClick={setLink}>
            确认
          </button>
          <button
            type="button"
            className="btn btn-secondary link-btn"
            onClick={() => {
              setShowLinkInput(false);
              setLinkInputValue('');
              setLinkError('');
            }}
          >
            取消
          </button>
        </div>
      )}

      <EditorContent editor={editor} className="editor-content-wrapper" />
    </div>
  );
}
