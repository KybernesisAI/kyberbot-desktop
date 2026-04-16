/**
 * Orchestration Files — artifact list and content viewer.
 */

import { useState, useCallback } from 'react';
import type { UseOrchResult } from '../../hooks/useOrch';
import type { OrchArtifact } from './types';
import MarkdownRenderer from '../chat/MarkdownRenderer';

interface Props {
  orch: UseOrchResult;
  onOpenIssue?: (id: number) => void;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

function getFileExtension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'toml', 'xml',
  'css', 'scss', 'html', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp',
  'h', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'prisma', 'dockerfile',
]);

export default function OrchFiles({ orch, onOpenIssue }: Props) {
  const { artifacts, loading } = orch;
  const [filterAgent, setFilterAgent] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contentCache, setContentCache] = useState<Record<number, string>>({});
  const [loadingContent, setLoadingContent] = useState(false);

  const agents = [...new Set(artifacts.map(a => a.agent_name))];
  const filtered = filterAgent ? artifacts.filter(a => a.agent_name === filterAgent) : artifacts;

  const handleToggle = useCallback(async (artifact: OrchArtifact) => {
    if (expandedId === artifact.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(artifact.id);
    if (!contentCache[artifact.id]) {
      setLoadingContent(true);
      try {
        const content = await orch.loadArtifactContent(artifact.id);
        setContentCache(prev => ({ ...prev, [artifact.id]: content }));
      } catch {
        setContentCache(prev => ({ ...prev, [artifact.id]: '// Failed to load file content' }));
      } finally {
        setLoadingContent(false);
      }
    }
  }, [expandedId, contentCache, orch]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Loading...</div>;
  }

  if (artifacts.length === 0) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>No artifacts yet</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)', minHeight: '52px' }}>
        <span className="section-title" style={{ color: 'var(--accent-teal)' }}>{'// FILES'}</span>
        <div className="flex items-center gap-3">
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', color: 'var(--fg-primary)', padding: '8px 10px',
            }}
          >
            <option value="">All agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
            {filtered.length} file{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Artifact list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {filtered.map(artifact => {
          const ext = getFileExtension(artifact.file_path);
          const isExpanded = expandedId === artifact.id;
          const content = contentCache[artifact.id];

          return (
            <div key={artifact.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
              {/* Row */}
              <div
                onClick={() => handleToggle(artifact)}
                style={{ padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
              >
                {/* Expand indicator */}
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '2px', flexShrink: 0, width: '10px' }}>
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </span>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)', fontWeight: 500 }}>
                      {basename(artifact.file_path)}
                    </span>
                    {artifact.issue_id && (
                      <span
                        onClick={e => { e.stopPropagation(); onOpenIssue?.(artifact.issue_id!); }}
                        style={{
                          fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)',
                          cursor: 'pointer',
                        }}
                      >
                        KYB-{artifact.issue_id}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {artifact.agent_name}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {artifact.file_path}
                  </div>
                  {artifact.description && (
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', marginTop: '4px' }}>
                      {artifact.description}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', flexShrink: 0 }}>
                  {new Date(artifact.created_at + 'Z').toLocaleString()}
                </span>
              </div>

              {/* Expanded content viewer */}
              {isExpanded && (
                <div style={{ padding: '0 0 12px 22px' }}>
                  {loadingContent && !content ? (
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>Loading...</span>
                  ) : content !== undefined ? (
                    <div style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      padding: '12px',
                      maxHeight: '400px',
                      overflow: 'auto',
                    }}>
                      {ext === 'md' ? (
                        <MarkdownRenderer content={content} />
                      ) : (
                        <pre style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--fg-primary)',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {content}
                        </pre>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
