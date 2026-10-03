import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Sparkles, Link as LinkIcon, X, RotateCcw, Check } from 'lucide-react';
import type { GameSpec } from '../types/gameSpec';
import type { StoredPlayablePost } from '../engine/runtime/generationPipeline';
import type { ExperienceV2, MissingInfo } from '../engine/experience/types';
import { regate } from '../engine/experience/situation';
import { CLARIFY_QUESTION, MISSING_LABEL } from '../engine/experience/copy';
import { telemetry } from '../engine/runtime/telemetry';
import { CreateView } from './CreateView';

/**
 * Author flow, Experience V2.
 *
 *   1. Tell it.            One text box.
 *   2. The moment.         Where the decision falls; everything after it stays hidden.
 *   3. What did you do?    Separately, with optional "why" and "what happened next".
 *   4. Preview.            What the scene will use, which of it came from your words,
 *                          and a way to remove anything wrong. At most one question.
 *
 * Nothing here is sent to a model except the text before the decision.
 */

const examples = [
  { title: 'Сообщение', text: 'Мы с Аней живём вместе третий год. В тот вечер она ушла в душ, а её телефон остался на столике передо мной. Экран загорелся: «Марк: Ты уже сказала ему?». Мы договаривались не читать переписки друг друга.' },
  { title: 'Планёрка', text: 'Два месяца я делал модель для отдела. На планёрке коллега показал её от своего имени. Руководитель сказала: «Отличная работа» — и спросила, есть ли вопросы. Этот коллега через месяц пишет на меня отзыв.' },
  { title: 'Лифт', text: 'Во втором часу ночи я вызвал лифт. Внутри никого, только чей-то расстёгнутый рюкзак с ключами. Похожий брелок я видел у соседки с девятого. Стучать к ней ночью неловко, оставить ключи — тоже.' },
];

const FORMAT_TITLE: Record<string, string> = {
  playable: 'Ситуация, в которую можно войти',
  illustrated_memory: 'Иллюстрированное воспоминание',
  text_story: 'Текстовая история',
};

interface Analysis {
  sentences: Array<{ index: number; text: string }>;
  cutAt: number;
  marker?: string;
  perspective: boolean;
}

interface ViviCreateProps {
  initialGameToEdit?: GameSpec | null;
  initialPostToEdit?: StoredPlayablePost | null;
  initialPrompt?: string;
  responseToPostId?: string;
  themeKey?: string;
  onSaveGame?: (game: GameSpec) => void;
  onPlayGame?: (game: GameSpec) => void;
  onSavePost?: (post: StoredPlayablePost) => void;
  onPlayPost?: (post: StoredPlayablePost) => void;
  onCancelResponse?: () => void;
}

type Step = 'tell' | 'moment' | 'act' | 'preview';

export function ViviCreate({
  initialGameToEdit,
  initialPostToEdit,
  initialPrompt = '',
  responseToPostId,
  themeKey,
  onSaveGame,
  onPlayGame,
  onSavePost,
  onPlayPost,
  onCancelResponse,
}: ViviCreateProps) {
  const [advanced, setAdvanced] = useState(false);
  const [step, setStep] = useState<Step>(initialPostToEdit ? 'preview' : 'tell');
  const [story, setStory] = useState(initialPrompt || initialPostToEdit?.inspirationPrompt || initialGameToEdit?.description || '');
  const [author, setAuthor] = useState(initialPostToEdit?.scenario?.author || initialGameToEdit?.author || '');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [cutAt, setCutAt] = useState(0);
  const [act, setAct] = useState(initialPostToEdit?.scenario?.authorTruth?.text ?? '');
  const [why, setWhy] = useState(initialPostToEdit?.scenario?.authorTruth?.why ?? '');
  const [after, setAfter] = useState(initialPostToEdit?.scenario?.authorTruth?.after ?? '');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [post, setPost] = useState<StoredPlayablePost | null>(initialPostToEdit ?? null);
  const [answer, setAnswer] = useState('');
  const [saved, setSaved] = useState(false);

  const before = useMemo(() => (analysis ? analysis.sentences.slice(0, cutAt).map(s => s.text).join(' ') : story), [analysis, cutAt, story]);
  const hidden = useMemo(() => (analysis ? analysis.sentences.slice(cutAt).map(s => s.text).join(' ') : ''), [analysis, cutAt]);

  /* ------------------------------------------------------------ steps --- */

  const analyse = async () => {
    if (!story.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/analyze-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: story }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не получилось разобрать текст.');
      setAnalysis(data);
      setCutAt(data.cutAt);
      // What the author wrote after the decision is their own account of it.
      if (data.after && !act.trim()) setAct(data.after);
      setStep(data.sentences.length > 1 ? 'moment' : 'act');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Что-то пошло не так.');
    } finally {
      setBusy(false);
    }
  };

  const generate = async (beforeText = before) => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: beforeText,
          storyBeforeDecision: beforeText,
          whatReallyHappened: act,
          authorWhy: why,
          authorAfter: after,
          genre: themeKey || 'Situations',
          author: author.trim() || 'Anonymous',
          responseToPostId,
        }),
      });
      const data = await res.json();
      if (import.meta.env.DEV && data.compilerReport) {
        try {
          sessionStorage.setItem('vivi:lastGeneration', JSON.stringify(data.compilerReport));
        } catch {
          // storage unavailable
        }
      }
      if (!res.ok || !data.playablePost) throw new Error(data.error || 'Vivi не удалось собрать эту историю.');
      setPost(data.playablePost as StoredPlayablePost);
      setStep('preview');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Что-то пошло не так. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------- preview --- */

  const experience: ExperienceV2 | undefined = post?.scenario.experience;

  /** Apply an author correction: remove an item the story does not support, then re-run the gate. */
  const correct = (kind: 'fact' | 'look' | 'deed', id: string) => {
    if (!post || !experience) return;
    telemetry.recordEvent('author_detail_corrected', 0, { objectId: kind });
    const next: ExperienceV2 = {
      ...experience,
      facts: kind === 'fact' ? experience.facts.filter(f => f.id !== id) : experience.facts,
      observations: kind === 'look' ? experience.observations.filter(o => o.id !== id) : experience.observations,
      commitments: kind === 'deed' ? experience.commitments.filter(c => c.id !== id) : experience.commitments,
      removed: [...(experience.removed ?? []), id],
    };
    const gated = regate(next, { hasAuthorAct: post.scenario.authorTruth.status !== 'withheld' });
    updatePost(gated);
  };

  const confirmFact = (id: string) => {
    if (!experience) return;
    updatePost({ ...experience, facts: experience.facts.map(f => (f.id === id ? { ...f, origin: 'author_confirmed' } : f)) });
  };

  const setAuthorChoice = (id: string) => {
    if (!post) return;
    setPost({ ...post, scenario: { ...post.scenario, authorChoiceId: id || undefined } });
    setSaved(false);
  };

  const updatePost = (x: ExperienceV2) => {
    if (!post) return;
    setPost({ ...post, format: x.format, scenario: { ...post.scenario, experience: x } });
    setSaved(false);
  };

  /** The single clarifying question. The author act is local; the others need the scene rebuilt once. */
  const answerClarify = (missing: MissingInfo) => {
    const text = answer.trim();
    if (!text || !post || !experience) return;
    setAnswer('');
    if (missing === 'author_act') {
      setAct(text);
      const truth = { ...post.scenario.authorTruth, status: 'author_supplied' as const, text, sourceLabel: 'со слов автора' };
      const gated = regate(experience, { hasAuthorAct: true });
      setPost({ ...post, format: gated.format, scenario: { ...post.scenario, authorTruth: truth, reality: text, experience: gated } });
      return;
    }
    // The answer is the author's own words about the moment: it joins the text before the decision.
    const extended = `${before.trim()} ${text}`;
    setStory(s => `${s.trim()} ${text}`);
    if (analysis) {
      const sentences = [...analysis.sentences.slice(0, cutAt), { index: cutAt, text }, ...analysis.sentences.slice(cutAt).map(s => ({ ...s, index: s.index + 1 }))];
      setAnalysis({ ...analysis, sentences });
      setCutAt(cutAt + 1);
    }
    generate(extended);
  };

  const save = (play: boolean) => {
    if (!post) return;
    onSavePost?.(post);
    setSaved(true);
    if (play) onPlayPost?.(post);
  };

  /* ------------------------------------------------------------ render --- */

  if (advanced) {
    return (
      <div className="vivi-create-advanced">
        <button onClick={() => setAdvanced(false)}>← Назад к создателю Vivi</button>
        <CreateView initialGameToEdit={post?.legacyGameSpec || initialGameToEdit} onSaveGame={g => onSaveGame?.(g)} onPlayGame={g => onPlayGame?.(g)} />
      </div>
    );
  }

  const stepIndex = ['tell', 'moment', 'act', 'preview'].indexOf(step);

  return (
    <main className="vivi-create vivi-author">
      {responseToPostId && (
        <div className="vivi-author-link">
          <LinkIcon size={14} />
          <span>Ваша история будет связана с той, на которую вы отвечаете.</span>
          {onCancelResponse && (
            <button type="button" onClick={onCancelResponse}>
              Отвязать
            </button>
          )}
        </div>
      )}

      <ol className="vivi-author-steps" aria-label="Шаги">
        {['Рассказ', 'Момент', 'Поступок', 'Предпросмотр'].map((label, i) => (
          <li key={label} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''}>
            {label}
          </li>
        ))}
      </ol>

      {step === 'tell' && (
        <section className="vivi-author-card">
          <span className="vivi-eyebrow">ШАГ 1</span>
          <h1>Что с тобой произошло?</h1>
          <p className="vivi-author-lead">Своими словами: где ты был(а), кто был рядом и в какой момент пришлось что-то решить.</p>
          <textarea value={story} onChange={e => setStory(e.target.value)} rows={7} aria-label="Ваша история" placeholder="Я сидел в переговорной, когда коллега показал директору слайд, который сделал я…" />
          <div className="vivi-author-row">
            <label className="vivi-author-field">
              Псевдоним
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Анонимно" />
            </label>
            <button className="vivi-dock-commit" disabled={busy || !story.trim()} onClick={analyse}>
              {busy ? 'Читаю…' : 'Дальше'} <ArrowRight size={16} />
            </button>
          </div>
          {error && <p className="vivi-create-error" role="alert">{error}</p>}
          <div className="vivi-author-examples">
            <span className="vivi-eyebrow">ПРИМЕРЫ (ВЫМЫШЛЕННЫЕ)</span>
            {examples.map(ex => (
              <button key={ex.title} type="button" onClick={() => setStory(ex.text)}>
                <strong>{ex.title}</strong>
                <span>{ex.text}</span>
              </button>
            ))}
          </div>
          <button className="vivi-advanced-link" onClick={() => setAdvanced(true)}>
            Расширенный редактор (для разработчиков) ↗
          </button>
        </section>
      )}

      {step === 'moment' && analysis && (
        <section className="vivi-author-card">
          <span className="vivi-eyebrow">ШАГ 2</span>
          <h1>Где был момент решения?</h1>
          <p className="vivi-author-lead">
            Игрок увидит всё до черты. Всё после неё останется скрытым, пока он не сделает свой выбор. Нажмите на предложение, с которого начинается то, что было <em>после</em> решения.
          </p>
          <ol className="vivi-boundary-list">
            {analysis.sentences.map((s, i) => (
              <li key={s.index} className={i >= cutAt ? 'is-after' : ''}>
                {i === cutAt && <span className="vivi-boundary-line">скрыто до выбора</span>}
                <button type="button" onClick={() => setCutAt(i === 0 ? 1 : i)} disabled={i === 0} aria-label={`Решение начинается после: ${s.text}`}>
                  {s.text}
                </button>
              </li>
            ))}
            {cutAt >= analysis.sentences.length && <li className="vivi-boundary-end">Всё рассказанное — до решения.</li>}
          </ol>
          {analysis.marker && <p className="vivi-dock-quiet">Черта поставлена по словам «{analysis.marker}». Проверьте.</p>}
          {!analysis.perspective && <p className="vivi-author-warn">История рассказана не от первого лица. Скорее всего, она станет текстовой историей, а не ситуацией.</p>}
          <div className="vivi-author-row">
            <button type="button" className="vivi-dock-ghost" onClick={() => setStep('tell')}>
              Назад
            </button>
            <button type="button" className="vivi-dock-commit" onClick={() => {
              if (hidden && !act.trim()) setAct(hidden);
              setStep('act');
            }}>
              Да, момент здесь <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}

      {step === 'act' && (
        <section className="vivi-author-card">
          <span className="vivi-eyebrow">ШАГ 3</span>
          <h1>Что ты сделал(а)?</h1>
          <p className="vivi-author-lead">Это увидят только после выбора. Без этого история станет воспоминанием, а не ситуацией.</p>
          <textarea value={act} onChange={e => setAct(e.target.value)} rows={3} aria-label="Что вы сделали" placeholder="Я подождал конца встречи и отправил директору исходные файлы…" />
          <button type="button" className="vivi-text-button" onClick={() => setShowMore(v => !v)}>
            {showMore ? 'Скрыть' : 'Добавить «почему» и «что было потом» (необязательно)'}
          </button>
          {showMore && (
            <>
              <label className="vivi-author-field">
                Почему? <span>необязательно</span>
                <textarea value={why} onChange={e => setWhy(e.target.value)} rows={2} />
              </label>
              <label className="vivi-author-field">
                Что случилось потом? <span>необязательно</span>
                <textarea value={after} onChange={e => setAfter(e.target.value)} rows={2} />
              </label>
            </>
          )}
          <div className="vivi-author-row">
            <button type="button" className="vivi-dock-ghost" onClick={() => setStep(analysis && analysis.sentences.length > 1 ? 'moment' : 'tell')}>
              Назад
            </button>
            <button type="button" className="vivi-dock-commit" disabled={busy} onClick={() => generate()}>
              <Sparkles size={16} /> {busy ? 'Собираю сцену…' : 'Собрать'}
            </button>
          </div>
          {error && <p className="vivi-create-error" role="alert">{error}</p>}
        </section>
      )}

      {step === 'preview' && post && (
        <section className="vivi-author-card is-preview">
          <span className="vivi-eyebrow">ШАГ 4 · ПРЕДПРОСМОТР</span>
          <h1>{post.title}</h1>
          <p className="vivi-author-format">
            <span className={`vivi-format-badge is-${post.format ?? 'playable'}`}>{FORMAT_TITLE[post.format ?? 'playable']}</span>
            {experience && experience.missing.length > 0 && <span className="vivi-dock-quiet">Чего не хватает: {experience.missing.map(m => MISSING_LABEL[m]).join('; ')}.</span>}
          </p>

          {experience?.clarify && (
            <div className="vivi-author-clarify">
              <label htmlFor="vivi-clarify">{CLARIFY_QUESTION[experience.clarify].ru}</label>
              <textarea id="vivi-clarify" rows={2} value={answer} onChange={e => setAnswer(e.target.value)} />
              <div className="vivi-author-row">
                <span className="vivi-dock-quiet">Один вопрос. Можно не отвечать и сохранить как есть.</span>
                <button type="button" className="vivi-dock-commit" disabled={!answer.trim() || busy} onClick={() => answerClarify(experience.clarify!)}>
                  {busy ? 'Пересобираю…' : 'Ответить'}
                </button>
              </div>
            </div>
          )}

          {experience && experience.format === 'playable' && (
            <div className="vivi-author-review">
              {experience.moment && (
                <div>
                  <h2>Момент</h2>
                  <p className="vivi-dock-moment">{experience.moment.text}</p>
                  {experience.whyHard && <p className="vivi-dock-hard">{experience.whyHard.text}</p>}
                </div>
              )}
              <ReviewList
                title="Что знает герой"
                items={experience.facts.map(f => ({ id: f.id, text: f.text, sourced: f.origin !== 'unsourced', confirmed: f.origin === 'author_confirmed', quote: f.ref?.quote }))}
                onRemove={id => correct('fact', id)}
                onConfirm={confirmFact}
              />
              <ReviewList
                title="Что можно рассмотреть"
                items={experience.observations.map(o => ({ id: o.id, text: `${o.label}: ${o.reveals}`, sourced: o.sourced, quote: o.ref?.quote }))}
                onRemove={id => correct('look', id)}
              />
              <ReviewList
                title="Решения, которые предложит сцена"
                items={experience.commitments.map(c => ({ id: c.id, text: c.label, sourced: true, plain: true }))}
                onRemove={id => correct('deed', id)}
              />
              <label className="vivi-author-field">
                Какое из решений ближе к тому, что сделал(а) ты? <span>необязательно — не помечается как «правильное»</span>
                <select value={post.scenario.authorChoiceId ?? ''} onChange={e => setAuthorChoice(e.target.value)}>
                  <option value="">Ни одно / не указывать</option>
                  {experience.commitments.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {experience && experience.format !== 'playable' && (
            <div className="vivi-author-review">
              <p className="vivi-dock-quiet">
                Vivi не превращает эту историю в игру и не достраивает её. Она будет показана как {experience.format === 'text_story' ? 'текст' : 'текст поверх иллюстрации места'}, со ссылкой «У меня было похоже».
              </p>
            </div>
          )}

          <div className="vivi-author-hidden">
            <h2>Скрыто до выбора</h2>
            <p>{post.scenario.authorTruth.status === 'withheld' ? 'Вы не рассказали, что сделали.' : post.scenario.authorTruth.text}</p>
            {post.scenario.authorTruth.why && <p className="vivi-dock-quiet">Почему: {post.scenario.authorTruth.why}</p>}
            {post.scenario.authorTruth.after && <p className="vivi-dock-quiet">Потом: {post.scenario.authorTruth.after}</p>}
          </div>

          <div className="vivi-author-row">
            <button type="button" className="vivi-dock-ghost" onClick={() => setStep('act')}>
              <RotateCcw size={15} /> Изменить ответы
            </button>
            <span className="vivi-author-actions">
              <button type="button" className="vivi-dock-ghost" onClick={() => save(false)}>
                {saved ? <><Check size={15} /> Сохранено</> : 'Сохранить'}
              </button>
              <button type="button" className="vivi-dock-commit" onClick={() => save(true)}>
                Сохранить и открыть <ArrowUpRight size={16} />
              </button>
            </span>
          </div>
        </section>
      )}
    </main>
  );
}

function ReviewList({
  title,
  items,
  onRemove,
  onConfirm,
}: {
  title: string;
  items: Array<{ id: string; text: string; sourced: boolean; confirmed?: boolean; quote?: string; plain?: boolean }>;
  onRemove: (id: string) => void;
  onConfirm?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h2>{title}</h2>
      <ul className="vivi-review-list">
        {items.map(item => (
          <li key={item.id}>
            <span className="vivi-review-text">
              {item.text}
              {!item.plain && (
                <span className={`vivi-review-origin ${item.sourced ? 'is-sourced' : 'is-unsourced'}`} title={item.quote}>
                  {item.confirmed ? 'подтверждено вами' : item.sourced ? 'из вашего текста' : 'не нашлось в тексте — проверьте'}
                </span>
              )}
            </span>
            <span className="vivi-review-actions">
              {!item.sourced && !item.confirmed && onConfirm && (
                <button type="button" onClick={() => onConfirm(item.id)} aria-label={`Это верно: ${item.text}`}>
                  <Check size={14} /> верно
                </button>
              )}
              <button type="button" onClick={() => onRemove(item.id)} aria-label={`Убрать: ${item.text}`}>
                <X size={14} /> убрать
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
