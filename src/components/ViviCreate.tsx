import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowUpRight, Sparkles, Link as LinkIcon } from 'lucide-react';
import type { GameSpec } from '../types/gameSpec';
import { type StoredPlayablePost } from '../engine/runtime/generationPipeline';
import { CreateView } from './CreateView';

const prompts = [
  { title: 'Сообщение', text: 'Партнер ушел в душ. На экране телефона загорелось сообщение, которое невозможно было развидеть.' },
  { title: 'Презентация', text: 'Коллега на созвоне представил мою работу как свою. Директор спросил: «Есть ли комментарии?»' },
  { title: 'Дверной звонок', text: 'Четвертую ночь домофон звонил ровно в 03:17. На экране никого. А потом ручка двери шевельнулась.' },
];

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
  const [story, setStory] = useState(
    initialPrompt ||
    initialPostToEdit?.scenario?.setup ||
    initialPostToEdit?.synopsis ||
    initialGameToEdit?.description ||
    ''
  );
  const [reality, setReality] = useState(
    initialPostToEdit?.scenario?.reality ||
    initialPostToEdit?.scenario?.authorTruth?.text ||
    initialGameToEdit?.whatReallyHappened ||
    ''
  );
  const [author, setAuthor] = useState(
    initialPostToEdit?.scenario?.author ||
    initialGameToEdit?.author ||
    'Anonymous'
  );
  const [pillar, setPillar] = useState(
    themeKey ||
    initialPostToEdit?.pillar ||
    'Relationships'
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GameSpec | null>(initialGameToEdit || null);
  const [generatedPost, setGeneratedPost] = useState<StoredPlayablePost | null>(initialPostToEdit || null);

  useEffect(() => {
    if (initialPrompt && !story) {
      setStory(initialPrompt);
    }
  }, [initialPrompt]);

  const generate = async () => {
    if (!story.trim()) return;
    setGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: story,
          whatReallyHappened: reality,
          genre: pillar,
          author: author || 'Anonymous',
          responseToPostId,
        }),
      });

      const data = await response.json();
      if (import.meta.env.DEV && data.compilerReport) {
        // Dev only: lets ?lab show what the real Create flow just did (no story text, no secrets).
        try {
          sessionStorage.setItem('vivi:lastGeneration', JSON.stringify(data.compilerReport));
        } catch {
          // storage unavailable
        }
      }
      if (!response.ok || (!data.gameSpec && !data.scenario)) {
        throw new Error(data.error || 'Vivi не удалось построить мир для этой ситуации.');
      }

      const post: StoredPlayablePost = data.playablePost || {
        schemaVersion: 2,
        id: data.scenario?.id || data.gameSpec?.id,
        title: data.scenario?.title || data.gameSpec?.title,
        synopsis: data.scenario?.synopsis || data.gameSpec?.synopsis,
        pillar: data.scenario?.pillar || pillar,
        world: data.scenario?.world || 'apartment_night',
        authorHandle: data.scenario?.authorHandle || `@${(author || 'creator').toLowerCase().replace(/\s+/g, '_')}`,
        createdAt: Date.now(),
        scenario: data.scenario,
        analysis: data.analysis,
        experiencePlan: data.experiencePlan,
        legacyGameSpec: data.gameSpec,
        responseToPostId: data.responseToPostId || responseToPostId,
        themeKey: data.themeKey || pillar,
        inspirationPrompt: data.inspirationPrompt || story,
      };

      setGeneratedPost(post);
      if (data.gameSpec) {
        setGenerated(data.gameSpec);
      }
      if (onSavePost) {
        onSavePost(post);
      } else if (onSaveGame) {
        onSaveGame(data.gameSpec || (post as any));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Что-то пошло не так. Попробуйте еще раз.');
    } finally {
      setGenerating(false);
    }
  };

  if (advanced) {
    return (
      <div className="vivi-create-advanced">
        <button onClick={() => setAdvanced(false)}>← Назад к создателю Vivi</button>
        <CreateView
          initialGameToEdit={generatedPost?.legacyGameSpec || generated || initialGameToEdit}
          onSaveGame={(game) => {
            if (onSaveGame) onSaveGame(game);
          }}
          onPlayGame={(game) => {
            if (onPlayGame) onPlayGame(game);
          }}
        />
      </div>
    );
  }

  return (
    <main className="vivi-create">
      {responseToPostId && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-stone-800">
            <LinkIcon size={14} className="text-amber-700" />
            <span>
              Создание связанной истории в ответ на ситуацию <strong>#{responseToPostId}</strong>
            </span>
          </div>
          {onCancelResponse && (
            <button onClick={onCancelResponse} className="text-stone-500 hover:text-stone-800 underline">
              Отвязать
            </button>
          )}
        </div>
      )}

      <div className="vivi-create-heading">
        <span className="vivi-eyebrow">РАССКАЖИТЕ, ЧТО С ВАМИ ПРОИЗОШЛО</span>
        <h1>
          Что произошло<br />
          <em>с вами?</em>
        </h1>
        <p>
          Расскажите своими словами. Vivi соберёт из этого маленький мир, куда можно войти и выбрать — до того, как узнаешь, чем всё кончилось.
        </p>
      </div>

      <div className="vivi-create-grid">
        <section className="vivi-create-form">
          <div className="vivi-create-step">
            <span>01</span>
            <h2>Что произошло?</h2>
            <p>Где это было, кто был рядом и в какой момент стало понятно, что придётся что-то сделать.</p>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={6}
              placeholder="Я сидел в переговорной, когда коллега показал директору слайд, который подготовил я…"
            />
          </div>

          <div className="vivi-create-step">
            <span>02 · необязательно</span>
            <h2>Что произошло потом?</h2>
            <p>Это останется скрытым, пока человек не сделает свой выбор. Можно не отвечать.</p>
            <textarea
              value={reality}
              onChange={(e) => setReality(e.target.value)}
              rows={4}
              placeholder="Я подождал конца встречи, а затем отправил оригинальные файлы директору с историей версий…"
            />
          </div>

          <div className="vivi-create-fields">
            <label>
              Категория ситуации
              <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
                {[
                  'Relationships',
                  'Creepy',
                  'Social disaster',
                  'Work',
                  'Money',
                  'Family',
                  'Strange moments',
                  'Moral dilemma',
                  'Romance',
                  'Life turning point',
                  'Memory',
                ].map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Авторский псевдоним
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="@username или Анонимно"
              />
            </label>
          </div>

          {error && (
            <p className="vivi-create-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="vivi-button vivi-create-submit"
            onClick={generate}
            disabled={generating || !story.trim()}
          >
            <Sparkles size={17} />
            {generating ? 'Строим ваш 2D мир…' : 'Собрать интерактивную историю'}
            <ArrowRight size={17} />
          </button>

          {(generatedPost || generated) && (
            <div className="vivi-create-result">
              <span className="vivi-eyebrow">ИСТОРИЯ ГОТОВА</span>
              <h3>{generatedPost?.title || generated?.title}</h3>
              <p>{generatedPost?.synopsis || generated?.synopsis}</p>
              <button
                className="vivi-button mt-3 text-xs py-2 px-4"
                onClick={() => {
                  if (generatedPost && onPlayPost) {
                    onPlayPost(generatedPost);
                  } else if (generatedPost && onPlayGame) {
                    onPlayGame(generatedPost.legacyGameSpec || (generatedPost as any));
                  } else if (generated && onPlayGame) {
                    onPlayGame(generated);
                  }
                }}
              >
                Войти в созданный мир <ArrowUpRight size={16} />
              </button>
            </div>
          )}
        </section>

        <aside className="vivi-create-aside">
          <div>
            <span className="vivi-eyebrow">ФОРМУЛА VIVI</span>
            <h2>Не сценарий игры.<br />А человеческий момент.</h2>
            <p>
              Где вы были? Что изменилось? Что заставило вас сомневаться? Остальное Vivi соберёт само: комнату, людей и то, к чему можно подойти.
            </p>
          </div>

          <div className="vivi-inspiration">
            <span className="vivi-eyebrow">ПРИМЕРЫ СИТУАЦИЙ</span>
            {prompts.map((prompt) => (
              <button key={prompt.title} onClick={() => setStory(prompt.text)}>
                <strong>{prompt.title}</strong>
                <span>{prompt.text}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>

          <button className="vivi-advanced-link text-stone-400 text-xs" onClick={() => setAdvanced(true)}>
            Открыть расширенный редактор (для разработчиков) ↗
          </button>
        </aside>
      </div>
    </main>
  );
}
