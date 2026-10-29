import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bot, Check, Copy, GripVertical, History, MessageCircle, MessageSquarePlus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import api, { errorMessage } from '../api/client';

const suggestions = [
  'How does YESGAP calculate skill gaps?',
  'How do I find lessons for a skill?',
  'How do opportunity applications work?',
];

const chatIdOf = (chat) => String(chat?._id || chat?.id || '');
const launcherPositionKey = 'yesgap-assistant-launcher-position';
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

const chatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function AssistantCodeBlock({ code }) {
  const [copyState, setCopyState] = useState('idle');
  const copyTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard copy failed');
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1600);
  };

  return <div className="assistant-code-block">
    <div className="assistant-code-toolbar">
      <span>Code</span>
      <button type="button" onClick={copyCode} aria-label={copyState === 'copied' ? 'Code copied' : 'Copy code'}>
        {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Try again' : 'Copy'}
      </button>
    </div>
    <pre><code>{code}</code></pre>
  </div>;
}

const renderInlineMarkdown = (text, prefix) => String(text).split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*)/g)
  .filter(Boolean)
  .map((part, index) => {
    const key = `${prefix}-${index}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    return part.split('\n').flatMap((line, lineIndex) => lineIndex
      ? [<br key={`${key}-br-${lineIndex}`} />, line]
      : [line]);
  });

const renderAssistantMarkdown = (content) => {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${blocks.length}`;
    blocks.push(<p key={key}>{renderInlineMarkdown(paragraph.join('\n'), key)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === 'ordered' ? 'ol' : 'ul';
    const key = `list-${blocks.length}`;
    blocks.push(<Tag key={key}>{listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, `${key}-${index}`)}</li>)}</Tag>);
    listItems = [];
    listType = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) code.push(lines[index++]);
      blocks.push(<AssistantCodeBlock key={`code-${blocks.length}`} code={code.join('\n')} />);
      continue;
    }

    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Tag = `h${heading[1].length}`;
      const key = `h-${blocks.length}`;
      blocks.push(<Tag key={key}>{renderInlineMarkdown(heading[2], key)}</Tag>);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      const nextType = ordered ? 'ordered' : 'unordered';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((bullet || ordered)[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
};

const trimAssistantBoilerplate = (content) => String(content || '')
  .replace(/\s*\(Note:\s*You can explore more[\s\S]*?practice modules?\s*[.!?]?\s*\)\s*/i, '\n')
  .replace(/\s*Would you like to try modifying one of these examples,[\s\S]*$/i, '')
  .trim();

export default function AssistantChat() {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [draggingLauncher, setDraggingLauncher] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState(() => {
    try {
      if (typeof window === 'undefined') return null;
      const saved = JSON.parse(window.localStorage.getItem(launcherPositionKey) || 'null');
      return Number.isFinite(saved?.left) && Number.isFinite(saved?.top)
        ? { left: saved.left, top: saved.top }
        : null;
    } catch {
      return null;
    }
  });
  const [panelPlacement, setPanelPlacement] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const conversationIdRef = useRef(null);
  const activeUserIdRef = useRef(userId);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const launcherPositionRef = useRef(launcherPosition);
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0, moved: false });

  useEffect(() => {
    launcherPositionRef.current = launcherPosition;
  }, [launcherPosition]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPlacement(null);
      return undefined;
    }

    const placePanel = () => {
      const panel = panelRef.current;
      const launcher = launcherRef.current;
      if (!panel || !launcher) return;

      const margin = 10;
      const gap = 12;
      const launcherWidth = launcher.offsetWidth;
      const launcherHeight = launcher.offsetHeight;
      const panelWidth = panel.offsetWidth;
      const panelHeight = Math.min(600, Math.max(280, window.innerHeight - 120));
      const saved = launcherPositionRef.current;
      const buttonLeft = clamp(saved?.left ?? window.innerWidth - launcherWidth - 20, margin, window.innerWidth - launcherWidth - margin);
      const buttonTop = clamp(saved?.top ?? window.innerHeight - launcherHeight - 20, margin, window.innerHeight - launcherHeight - margin);
      const aboveSpace = buttonTop - gap - margin;
      const belowSpace = window.innerHeight - buttonTop - launcherHeight - gap - margin;
      const opensAbove = aboveSpace >= panelHeight || aboveSpace >= belowSpace;
      const availableHeight = opensAbove ? aboveSpace : belowSpace;
      const fittedHeight = Math.min(panelHeight, Math.max(280, availableHeight));
      const left = clamp(buttonLeft + launcherWidth - panelWidth, margin, window.innerWidth - panelWidth - margin);
      const top = opensAbove ? buttonTop - fittedHeight - gap : buttonTop;

      setPanelPlacement({ left, top, direction: opensAbove ? 'up' : 'down', height: fittedHeight });
    };

    placePanel();
    window.addEventListener('resize', placePanel);
    return () => window.removeEventListener('resize', placePanel);
  }, [open, launcherPosition]);

  useEffect(() => {
    const keepLauncherOnscreen = () => {
      const button = launcherRef.current;
      const current = launcherPositionRef.current;
      if (!button || !current || open) return;
      const next = {
        left: clamp(current.left, 10, window.innerWidth - button.offsetWidth - 10),
        top: clamp(current.top, 10, window.innerHeight - button.offsetHeight - 10),
      };
      launcherPositionRef.current = next;
      setLauncherPosition(next);
      try { window.localStorage.setItem(launcherPositionKey, JSON.stringify(next)); } catch { /* Ignore unavailable storage. */ }
    };
    keepLauncherOnscreen();
    window.addEventListener('resize', keepLauncherOnscreen);
    return () => window.removeEventListener('resize', keepLauncherOnscreen);
  }, [open]);

  const startLauncherDrag = (event) => {
    if (open || (event.button !== undefined && event.button !== 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveLauncher = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || open) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
    if (!drag.moved) setDraggingLauncher(true);
    drag.moved = true;
    const button = event.currentTarget;
    const next = {
      left: clamp(drag.startLeft + deltaX, 8, window.innerWidth - button.offsetWidth - 8),
      top: clamp(drag.startTop + deltaY, 8, window.innerHeight - button.offsetHeight - 8),
    };
    launcherPositionRef.current = next;
    setLauncherPosition(next);
  };

  const finishLauncherDrag = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    drag.pointerId = null;
    setDraggingLauncher(false);
    if (drag.moved && launcherPositionRef.current) {
      try { window.localStorage.setItem(launcherPositionKey, JSON.stringify(launcherPositionRef.current)); } catch { /* Ignore unavailable storage. */ }
    }
  };

  const toggleAssistant = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setOpen((current) => !current);
  };

  const setActiveConversation = (id) => {
    const normalizedId = id ? String(id) : null;
    conversationIdRef.current = normalizedId;
    setConversationId(normalizedId);
  };

  const upsertConversation = (chat) => {
    if (!chatIdOf(chat)) return;
    setConversations((current) => [chat, ...current.filter((item) => chatIdOf(item) !== chatIdOf(chat))].slice(0, 100));
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return undefined;
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (activeUserIdRef.current === userId) return;
    activeUserIdRef.current = userId;
    setActiveConversation(null);
    setMessages([]);
    setConversations([]);
    setShowHistory(false);
    setConfirmDeleteId(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setActiveConversation(null);
      setMessages([]);
      setConversations([]);
      setConfirmDeleteId(null);
      return undefined;
    }
    let cancelled = false;
    const loadRecentConversation = async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const response = await api.get('/assistant/chats');
        const chats = response.data?.data?.chats || [];
        if (cancelled) return;
        setConversations(chats);
        const activeId = conversationIdRef.current;
        const selected = chats.find((chat) => chatIdOf(chat) === activeId) || (!activeId ? chats[0] : null);
        if (!selected && !activeId) {
          setActiveConversation(null);
          setMessages([]);
          return;
        }
        const targetId = activeId || chatIdOf(selected);
        const detail = await api.get(`/assistant/chats/${encodeURIComponent(targetId)}`);
        if (cancelled) return;
        const chat = detail.data?.data?.chat;
        if (!chat) return;
        setActiveConversation(chatIdOf(chat));
        setMessages(chat.messages || []);
      } catch (error) {
        if (!cancelled) setHistoryError(errorMessage(error));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    if (open) loadRecentConversation();
    return () => { cancelled = true; };
  }, [open, userId]);

  if (!user) return null;

  const startNewChat = async () => {
    if (sending || historyLoading || deletingChatId) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.post('/assistant/chats');
      const chat = response.data?.data?.chat;
      if (!chat) throw new Error('Could not start a new chat. Please try again.');
      setActiveConversation(chatIdOf(chat));
      upsertConversation(chat);
      setMessages([]);
      setShowHistory(false);
      setConfirmDeleteId(null);
      inputRef.current?.focus();
    } catch (error) {
      setHistoryError(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const openConversation = async (chatId) => {
    if (sending || historyLoading || deletingChatId) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.get(`/assistant/chats/${encodeURIComponent(chatId)}`);
      const chat = response.data?.data?.chat;
      if (!chat) throw new Error('Could not open this chat. Please try again.');
      setActiveConversation(chatIdOf(chat));
      setMessages(chat.messages || []);
      setShowHistory(false);
      setConfirmDeleteId(null);
    } catch (error) {
      setHistoryError(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteConversation = async (chatId) => {
    if (sending || historyLoading || deletingChatId) return;
    setDeletingChatId(chatId);
    setHistoryError('');
    try {
      await api.delete(`/assistant/chats/${encodeURIComponent(chatId)}`);
      setConversations((current) => current.filter((chat) => chatIdOf(chat) !== chatId));
      setConfirmDeleteId(null);
      if (conversationIdRef.current === chatId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (error) {
      setHistoryError(errorMessage(error));
    } finally {
      setDeletingChatId(null);
    }
  };

  const send = async (value = draft) => {
    const question = String(value || '').trim();
    if (!question || sending || historyLoading) return;
    setMessages((current) => [...current, { role: 'user', text: question }].slice(-400));
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setShowHistory(false);
    setSending(true);
    let activeId = conversationIdRef.current;
    try {
      if (!activeId) {
        const created = await api.post('/assistant/chats');
        const newChat = created.data?.data?.chat;
        if (!newChat) throw new Error('Could not start a new chat. Please try again.');
        activeId = chatIdOf(newChat);
        setActiveConversation(activeId);
        upsertConversation(newChat);
      }
      const response = await api.post('/assistant/chat', {
        message: question,
        conversationId: activeId,
      }, { timeout: 35000 });
      const answer = response.data?.data?.answer || 'I could not create a reply. Please try again.';
      setMessages((current) => [...current, { role: 'assistant', text: answer }].slice(-400));
      const chat = response.data?.data?.chat;
      if (chat) upsertConversation(chat);
      const returnedId = response.data?.data?.conversationId;
      if (returnedId) setActiveConversation(returnedId);
    } catch (error) {
      const message = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
        ? 'The assistant is taking longer than expected. Please try again.'
        : errorMessage(error);
      setMessages((current) => [...current, { role: 'assistant', text: message }].slice(-400));
      if (activeId) {
        upsertConversation({
          _id: activeId,
          title: question.slice(0, 80),
          messageCount: 1,
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setSending(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    send();
  };

  const updateDraft = (event) => {
    setDraft(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
  };

  const rootStyle = panelPlacement
    ? { left: `${panelPlacement.left}px`, top: `${panelPlacement.top}px`, right: 'auto', bottom: 'auto' }
    : launcherPosition
      ? { left: `${launcherPosition.left}px`, top: `${launcherPosition.top}px`, right: 'auto', bottom: 'auto' }
      : undefined;

  return <div className={`assistant-chat-root ${panelPlacement?.direction === 'down' ? 'assistant-chat-root-open-down' : ''}`} style={rootStyle}>
    {open && <section ref={panelRef} className="assistant-panel" style={panelPlacement ? { height: `${panelPlacement.height}px` } : undefined} role="dialog" aria-label="YESGAP AI assistant">
      <header className="assistant-header">
        <div className="assistant-brand-icon"><Bot size={19} /></div>
        <div className="assistant-heading"><strong>YESGAP Assistant</strong><span><i />Career &amp; learning guide</span></div>
        <button className="assistant-new-chat" type="button" aria-label="Start a new chat" title="Start a new chat" onClick={startNewChat} disabled={sending || historyLoading || Boolean(deletingChatId)}><MessageSquarePlus size={15} /><span>New chat</span></button>
        <button className={`assistant-header-action ${showHistory ? 'assistant-header-action-active' : ''}`} type="button" aria-label={showHistory ? 'Hide saved chats' : 'Show saved chats'} title="Saved chats" onClick={() => setShowHistory((current) => !current)} disabled={sending || historyLoading || Boolean(deletingChatId)}><History size={17} /></button>
        <button className="assistant-header-action" type="button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>

      <div className="assistant-messages" aria-live="polite" aria-relevant="additions text">
        {showHistory ? <div className="assistant-history">
          <div className="assistant-history-heading"><strong>Saved chats</strong><span>Choose one to continue</span></div>
          {historyError && <p className="assistant-history-error">{historyError}</p>}
          {historyLoading && <p className="assistant-history-empty">Loading chats…</p>}
          {!historyLoading && !conversations.length && <p className="assistant-history-empty">No saved chats yet. Start a new chat to begin.</p>}
          {!historyLoading && conversations.map((chat) => {
            const chatId = chatIdOf(chat);
            const confirmingDelete = confirmDeleteId === chatId;
            return <div className={`assistant-history-row ${confirmingDelete ? 'assistant-history-row-confirming' : ''}`} key={chatId}>
              {confirmingDelete ? <div className="assistant-delete-confirmation" role="group" aria-label={`Confirm deletion of ${chat.title || 'chat'}`}>
                <div><strong>Delete this chat?</strong><span>This can’t be undone.</span></div>
                <button type="button" className="assistant-delete-cancel" onClick={() => setConfirmDeleteId(null)} disabled={Boolean(deletingChatId)}>Cancel</button>
                <button type="button" className="assistant-delete-confirm" onClick={() => deleteConversation(chatId)} disabled={Boolean(deletingChatId)}>{deletingChatId === chatId ? 'Deleting…' : 'Delete'}</button>
              </div> : <>
                <button
                  className={`assistant-history-item ${conversationId === chatId ? 'assistant-history-item-active' : ''}`}
                  type="button"
                  onClick={() => openConversation(chatId)}
                  disabled={Boolean(deletingChatId)}
                >
                  <span>{chat.title || 'New chat'}</span>
                  <time dateTime={chat.updatedAt}>{chatDate(chat.updatedAt)}</time>
                </button>
                <button className="assistant-history-delete" type="button" aria-label={`Delete chat ${chat.title || 'New chat'}`} title="Delete chat" onClick={() => { setHistoryError(''); setConfirmDeleteId(chatId); }} disabled={Boolean(deletingChatId)}><Trash2 size={15} /></button>
              </>}
            </div>;
          })}
        </div> : <>
          {!messages.length && <div className="assistant-welcome">
            <div className="assistant-welcome-icon"><Sparkles size={20} /></div>
            <p className="assistant-eyebrow">YOUR YESGAP GUIDE</p>
            <h2>What can I help with?</h2>
            <p>Ask about your skills, learning plan, career readiness, or anything in YESGAP.</p>
            <div className="assistant-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => send(suggestion)} disabled={sending || historyLoading}>{suggestion}<Send size={13} /></button>)}</div>
          </div>}
          {messages.map((message, index) => <article className={`assistant-message assistant-message-${message.role}`} key={`${index}-${message.role}`}>
            {message.role === 'assistant' && <span className="assistant-message-icon"><Bot size={14} /></span>}
            <div className="assistant-message-bubble">{message.role === 'assistant' ? renderAssistantMarkdown(trimAssistantBoilerplate(message.text)) : message.text}</div>
          </article>)}
          {sending && <div className="assistant-typing"><span /><span /><span /><em>Thinking…</em></div>}
        </>}
        <div ref={scrollRef} />
      </div>

      <div className="assistant-composer-wrap">
        <form className="assistant-composer" onSubmit={submit}>
          <textarea ref={inputRef} value={draft} onChange={updateDraft} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event); } }} rows="1" maxLength="2000" placeholder="Message YESGAP Assistant" aria-label="Ask YESGAP Assistant" disabled={historyLoading} />
          <button type="submit" className="assistant-send" aria-label="Send message" disabled={!draft.trim() || sending || historyLoading}><Send size={17} /></button>
        </form>
        <p className="assistant-composer-hint">Enter to send <span>·</span> Shift + Enter for a new line</p>
        <details className="assistant-privacy-note">
          <summary>AI can make mistakes · View privacy details</summary>
          <p>Messages and, when needed, your progress summary or candidate names and progress go to Gemini. Don’t share passwords or sensitive details.</p>
        </details>
      </div>
    </section>}
    <button
      ref={launcherRef}
      className={`assistant-launcher ${open ? 'assistant-launcher-open' : ''} ${draggingLauncher ? 'assistant-launcher-dragging' : ''}`}
      type="button"
      aria-label={open ? 'Close YESGAP assistant' : 'Open YESGAP assistant'}
      title={open ? 'Close YESGAP assistant' : 'Drag to move · Click to open'}
      aria-expanded={open}
      onPointerDown={startLauncherDrag}
      onPointerMove={moveLauncher}
      onPointerUp={finishLauncherDrag}
      onPointerCancel={finishLauncherDrag}
      onDragStart={(event) => event.preventDefault()}
      onClick={toggleAssistant}
    >
      {open ? <X size={22} /> : <><MessageCircle size={21} /><span>Ask YESGAP</span><GripVertical className="assistant-drag-handle" size={15} /></>}
    </button>
  </div>;
}
