'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './AIToolbar.module.css';

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'bold', label: 'Bold & Opinionated' },
];

export default function AIToolbar({ text, onResult, onHashtags }) {
  const [configured, setConfigured] = useState(null); // null=loading, true/false
  const [generating, setGenerating] = useState(false);
  const [showTones, setShowTones] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [topic, setTopic] = useState('');
  const toneRef = useRef(null);
  const genRef = useRef(null);

  useEffect(() => {
    fetch('/api/ai')
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured || false))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (toneRef.current && !toneRef.current.contains(e.target)) setShowTones(false);
      if (genRef.current && !genRef.current.contains(e.target)) setShowGenerate(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const callAI = async (action, opts = {}) => {
    setGenerating(true);
    setShowTones(false);
    setShowGenerate(false);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text, topic: opts.topic, tone: opts.tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.result || !data.result.trim()) {
        onResult(null, 'AI returned an empty response. Try again.');
        return;
      }
      if (action === 'hashtags' && onHashtags) {
        onHashtags(data.result);
      } else if (action === 'hook') {
        // Hooks: append below current text instead of replacing
        onResult(null, null, data.result); // pass as hooks
      } else {
        onResult(data.result);
      }
    } catch (err) {
      onResult(null, err.message);
    }
    setGenerating(false);
  };

  if (configured === null) return null; // loading
  if (configured === false) {
    return (
      <div className={styles.notConfigured}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
        <a href="/accounts">Set up AI</a> to generate and improve posts
      </div>
    );
  }

  return (
    <div className={styles.toolbar}>
      <span className={styles.sparkle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
      </span>

      {/* Generate from topic */}
      <div className={styles.toneMenu} ref={genRef}>
        <button className={`${styles.aiBtn} ${generating ? styles.generating : ''}`} onClick={() => setShowGenerate(!showGenerate)} disabled={generating}>
          {generating ? 'Generating...' : 'Generate'}
        </button>
        {showGenerate && (
          <div className={styles.toneDropdown} style={{ padding: 10, minWidth: 220 }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter topic..." style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, fontFamily: 'var(--sans)' }} autoFocus onKeyDown={(e) => e.key === 'Enter' && topic.trim() && callAI('generate', { topic })} />
            <button className={styles.toneItem} onClick={() => topic.trim() && callAI('generate', { topic })} style={{ fontWeight: 600 }}>Generate post</button>
          </div>
        )}
      </div>

      {/* Improve */}
      <button className={`${styles.aiBtn} ${generating ? styles.generating : ''}`} onClick={() => callAI('improve')} disabled={generating || !text?.trim()}>
        Improve
      </button>

      {/* Tone */}
      <div className={styles.toneMenu} ref={toneRef}>
        <button className={styles.aiBtn} onClick={() => setShowTones(!showTones)} disabled={generating || !text?.trim()}>
          Tone ▾
        </button>
        {showTones && (
          <div className={styles.toneDropdown}>
            {TONES.map((t) => (
              <button key={t.id} className={styles.toneItem} onClick={() => callAI('tone', { tone: t.id })}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shorter / Longer */}
      <button className={styles.aiBtn} onClick={() => callAI('shorter')} disabled={generating || !text?.trim()}>Shorter</button>
      <button className={styles.aiBtn} onClick={() => callAI('longer')} disabled={generating || !text?.trim()}>Longer</button>

      {/* Hashtags */}
      <button className={styles.aiBtn} onClick={() => callAI('hashtags')} disabled={generating || !text?.trim()}>
        # Hashtags
      </button>

      {/* Hooks */}
      <button className={styles.aiBtn} onClick={() => callAI('hook')} disabled={generating}>
        Hooks
      </button>
    </div>
  );
}
