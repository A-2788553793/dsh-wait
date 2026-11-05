window.__ModuleLoader__.load({
  id: 'dsh-wait',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-wait';
    const CARD_SEL = '[data-composer-card]';
    const OVERLAY_SEL = '[data-composer-overlay]';
    const DIALOG_SEL = '[data-dsh-wait-dialog]';
    const EDITOR_SEL = '[contenteditable="true"]';
    const TITLE_ID = 'dsh-wait-title';
    const DESC_ID = 'dsh-wait-desc';
    const MAX_PREVIEW = 4000;

    const DICTS = {
      zh: {
        title: '确认发送',
        hint: '按 Enter 或 Ctrl/Cmd+Enter 确认；Esc 取消，草稿会保留。',
        cancel: '取消',
        send: '发送',
        attachmentOnly: '（附件消息，无文字内容）',
        truncated: '…（预览已截断，实际发送完整内容）',
        dialogLabel: '发送确认',
      },
      en: {
        title: 'Confirm send',
        hint: 'Press Enter or Ctrl/Cmd+Enter to confirm. Esc cancels and keeps your draft.',
        cancel: 'Cancel',
        send: 'Send',
        attachmentOnly: '(Attachment message with no text)',
        truncated: '… (preview truncated; the full message will be sent)',
        dialogLabel: 'Send confirmation',
      },
    };

    const CSS = [
      '.dsh-wait-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto;box-sizing:border-box;}',
      '.dsh-wait-backdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-base);opacity:.45;}',
      '.dsh-wait-card{position:relative;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:12px;background:var(--dsw-alias-bg-overlay);border:0.5px solid var(--dsw-alias-border-l1);box-sizing:border-box;}',
      '.dsh-wait-title{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.dsh-wait-hint{font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);}',
      '.dsh-wait-preview{margin:0;padding:12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:0.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow:auto;max-height:40vh;user-select:text;}',
      '.dsh-wait-note{font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-wait-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}',
      '.dsh-wait-btn{height:32px;padding:0 14px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;border:0.5px solid transparent;outline:none;}',
      '.dsh-wait-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}',
      '.dsh-wait-btn-cancel{background:transparent;border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}',
      '.dsh-wait-btn-cancel:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-wait-btn-send{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);border-color:transparent;}',
      '.dsh-wait-btn-send:hover{opacity:.88;}',
    ].join('');

    let ctxRef = null;
    let bypass = false;
    let dialogMounted = false;
    let pending = null;
    const pendingListeners = new Set();

    function setPending(next) {
      pending = next;
      pendingListeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          /* ignore subscriber errors */
        }
      });
    }

    function subscribePending(listener) {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    }

    function getPending() {
      return pending;
    }

    function makeT(locale) {
      if (!locale || typeof locale.bind !== 'function') {
        return (key) => DICTS.zh[key] || key;
      }
      let bound = null;
      try {
        bound = locale.bind(NS);
      } catch (err) {
        bound = null;
      }
      return (key) => {
        if (bound) {
          try {
            const value = bound(key);
            if (value && value !== key) return value;
          } catch (err) {
            /* fall through */
          }
        }
        return DICTS.zh[key] || key;
      };
    }

    function readDraft(editor) {
      if (!editor) return '';
      if (typeof editor.innerText === 'string') return editor.innerText;
      return editor.textContent || '';
    }

    function lastButton(card) {
      if (!card) return null;
      const buttons = card.querySelectorAll('button');
      return buttons.length ? buttons[buttons.length - 1] : null;
    }

    function hasOpenPopup(card) {
      const anchor = card.querySelector(OVERLAY_SEL);
      if (!anchor) return false;
      for (const child of Array.from(anchor.children)) {
        if (child && child.getClientRects().length > 0) return true;
      }
      return false;
    }

    function isHero(card) {
      return !card.querySelector(OVERLAY_SEL);
    }

    function focusEditor(editor) {
      try {
        editor.focus({ preventScroll: true });
      } catch (err) {
        try {
          editor.focus();
        } catch (err2) {
          /* ignore */
        }
      }
    }

    function confirm() {
      const item = pending;
      if (!item) return;
      setPending(null);
      try {
        if (!item.editor || !item.editor.isConnected) return;
        if (!item.card || !item.card.isConnected) return;
        if (item.kind === 'click') {
          if (!item.button || !item.button.isConnected || item.button.disabled) return;
          focusEditor(item.editor);
          bypass = true;
          try {
            item.button.click();
          } finally {
            bypass = false;
          }
          return;
        }
        focusEditor(item.editor);
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          composed: true,
          ctrlKey: item.ctrlKey === true,
          metaKey: item.metaKey === true,
          shiftKey: false,
          altKey: false,
        });
        try {
          Object.defineProperty(event, 'keyCode', { get: () => 13 });
          Object.defineProperty(event, 'which', { get: () => 13 });
        } catch (err) {
          /* legacy fields are best-effort */
        }
        bypass = true;
        try {
          item.editor.dispatchEvent(event);
        } finally {
          bypass = false;
        }
      } catch (err) {
        console.warn('[dsh-wait] failed to replay the send action', err);
      }
    }

    function cancel() {
      const item = pending;
      setPending(null);
      if (item && item.editor && item.editor.isConnected) {
        focusEditor(item.editor);
      }
    }

    function handleKeyDown(e) {
      if (bypass || !dialogMounted || pending) return;
      if (!e || e.defaultPrevented) return;
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      if (e.repeat || e.shiftKey || e.altKey || (e.ctrlKey && e.metaKey)) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest(DIALOG_SEL)) return;
      const card = target.closest(CARD_SEL);
      if (!card) return;
      const editor = card.querySelector(EDITOR_SEL);
      if (!editor) return;
      if (!(editor === target || editor.contains(target))) return;
      const button = lastButton(card);
      if (!button || button.disabled) return;
      const draft = readDraft(editor);
      if (draft.trimStart().startsWith('/')) return;
      if (draft.trim() === '' && !isHero(card)) return;
      if (hasOpenPopup(card)) return;

      setPending({
        kind: 'key',
        draft,
        ctrlKey: e.ctrlKey === true,
        metaKey: e.metaKey === true,
        editor,
        card,
        hero: isHero(card),
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    function handleClick(e) {
      if (bypass || !dialogMounted || pending) return;
      if (!e || e.defaultPrevented) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest(DIALOG_SEL)) return;
      const button = target.closest('button');
      if (!button) return;
      const card = button.closest(CARD_SEL);
      if (!card) return;
      if (button !== lastButton(card)) return;
      if (button.disabled) return;
      const editor = card.querySelector(EDITOR_SEL);
      if (!editor) return;
      const draft = readDraft(editor);
      if (draft.trimStart().startsWith('/')) return;
      const hero = isHero(card);
      if (draft.trim() === '' && !hero) return;

      setPending({
        kind: 'click',
        draft,
        ctrlKey: false,
        metaKey: false,
        editor,
        card,
        button,
        hero,
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    function Dialog() {
      const locale = React.useCallback(() => {
        try {
          return ctxRef && ctxRef.get ? ctxRef.get('locale') : null;
        } catch (err) {
          return null;
        }
      }, [])();

      const subscribeLocale = React.useCallback(
        (callback) => {
          if (!locale || typeof locale.subscribe !== 'function') return () => {};
          return locale.subscribe(callback);
        },
        [locale],
      );
      const getLocaleRevision = React.useCallback(() => {
        if (!locale || typeof locale.getSnapshot !== 'function') return 0;
        try {
          const snapshot = locale.getSnapshot();
          return snapshot && typeof snapshot.revision === 'number' ? snapshot.revision : 0;
        } catch (err) {
          return 0;
        }
      }, [locale]);
      React.useSyncExternalStore(subscribeLocale, getLocaleRevision);

      const item = React.useSyncExternalStore(subscribePending, getPending);
      const t = React.useMemo(() => makeT(locale), [locale]);
      const cancelRef = React.useRef(null);
      const sendRef = React.useRef(null);
      const rootRef = React.useRef(null);

      React.useEffect(() => {
        dialogMounted = true;
        return () => {
          dialogMounted = false;
          if (pending) setPending(null);
        };
      }, []);

      React.useEffect(() => {
        if (item && sendRef.current) {
          try {
            sendRef.current.focus({ preventScroll: true });
          } catch (err) {
            /* ignore */
          }
        }
      }, [item]);

      React.useEffect(() => {
        if (!item) return undefined;
        const onFocusIn = (event) => {
          if (!pending) return;
          const root = rootRef.current;
          if (!root) return;
          if (event.target && root.contains(event.target)) return;
          if (sendRef.current) {
            try {
              sendRef.current.focus({ preventScroll: true });
            } catch (err) {
              /* ignore */
            }
          }
        };
        document.addEventListener('focusin', onFocusIn, true);
        return () => document.removeEventListener('focusin', onFocusIn, true);
      }, [item]);

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          confirm();
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          confirm();
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          const first = cancelRef.current;
          const second = sendRef.current;
          const next = document.activeElement === first ? second : first;
          if (next) next.focus();
          return;
        }
      };

      const onBackdropMouseDown = (event) => {
        if (event.button === 0) {
          event.preventDefault();
          cancel();
        }
      };

      const text = item ? String(item.draft || '') : '';
      const truncated = text.length > MAX_PREVIEW;
      const shown = truncated ? text.slice(0, MAX_PREVIEW) : text;
      const attachmentOnly = text.trim() === '';

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        item
          ? h(
              'div',
              {
                key: 'dialog',
                ref: rootRef,
                className: 'dsh-wait-overlay',
                'data-dsh-wait-dialog': true,
                role: 'alertdialog',
                'aria-modal': 'true',
                'aria-label': t('dialogLabel'),
                'aria-labelledby': TITLE_ID,
                'aria-describedby': DESC_ID,
                tabIndex: -1,
                onKeyDown,
              },
              h('div', { className: 'dsh-wait-backdrop', onMouseDown: onBackdropMouseDown }),
              h(
                'div',
                { className: 'dsh-wait-card' },
                h('div', { className: 'dsh-wait-title', id: TITLE_ID }, t('title')),
                h('div', { className: 'dsh-wait-hint', id: DESC_ID }, t('hint')),
                attachmentOnly
                  ? h('div', { className: 'dsh-wait-preview' }, t('attachmentOnly'))
                  : h('pre', { className: 'dsh-wait-preview' }, shown),
                truncated ? h('div', { className: 'dsh-wait-note' }, t('truncated')) : null,
                h(
                  'div',
                  { className: 'dsh-wait-actions' },
                  h(
                    'button',
                    {
                      ref: cancelRef,
                      type: 'button',
                      className: 'dsh-wait-btn dsh-wait-btn-cancel',
                      onClick: cancel,
                    },
                    t('cancel'),
                  ),
                  h(
                    'button',
                    {
                      ref: sendRef,
                      type: 'button',
                      className: 'dsh-wait-btn dsh-wait-btn-send',
                      onClick: confirm,
                    },
                    t('send'),
                  ),
                ),
              ),
            )
          : null,
      );
    }

    function install(ctx) {
      ctxRef = ctx;

      let locale = null;
      try {
        locale = ctx.get ? ctx.get('locale') : null;
      } catch (err) {
        locale = null;
      }

      if (locale && typeof locale.register === 'function') {
        ctx.effect(() => {
          const disposers = [];
          for (const [language, dict] of [
            ['zh', DICTS.zh],
            ['en', DICTS.en],
          ]) {
            try {
              const disposer = locale.register(NS, language, dict);
              if (typeof disposer === 'function') disposers.push(disposer);
            } catch (err) {
              console.warn('[dsh-wait] failed to register locale dictionary:', language, err);
            }
          }
          return () => {
            for (const disposer of disposers) {
              try {
                disposer();
              } catch (err) {
                /* ignore */
              }
            }
          };
        }, 'dsh-wait: locale dictionaries');
      }

      ctx.effect(() => {
        const onKeyDown = (event) => {
          try {
            handleKeyDown(event);
          } catch (err) {
            console.warn('[dsh-wait] key guard error (fail-open)', err);
          }
        };
        const onClick = (event) => {
          try {
            handleClick(event);
          } catch (err) {
            console.warn('[dsh-wait] click guard error (fail-open)', err);
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('click', onClick, true);
        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('click', onClick, true);
          if (pending) setPending(null);
        };
      }, 'dsh-wait: composer capture guard');

      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsh-wait-dialog',
              order: 1000,
            },
            Dialog,
          ),
        );
      } catch (err) {
        console.warn('[dsh-wait] failed to register the dialog slot', err);
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        install(ctx);
      },
    };
  },
});
