import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowUpRight, Sparkles, Link as LinkIcon } from 'lucide-react';
import type { GameSpec } from '../types/gameSpec';
import { CreateView } from './CreateView';

const prompts = [
  { title: 'Сообщение', text: 'Партнер ушел в душ. На экране телефона загорелось сообщение, которое невозможно было развидеть.' },
  { title: 'Презентация', text: 'Коллега на созвоне представил мою работу как свою. Директор спросил: «Есть ли комментарии?»' },
  { title: 'Дверной звонок', text: 'Четвертую ночь домофон звонил ровно в 03:17. На экране никого. А потом ручка двери шевельнулась.' },
];

interface ViviCreateProps {
  initialGameToEdit?: GameSpec | null;
  initialPrompt?: string;
  responseToPostId?: string;
  themeKey?: string;
  onSaveGame: (game: GameSpec) => void;
  onPlayGame: (game: GameSpec) => void;
  onCancelResponse?: () => void;
}

export function ViviCreate({
  initialGameToEdit,
  initialPrompt = '',
  responseToPostId,
  themeKey,
  onSaveGame,
  onPlayGame,
  onCancelResponse,
}: ViviCreateProps) {
  const [advanced, setAdvanced] = useState(false);
  const [story, setStory] = useState(initialPrompt || initialGameToEdit?.description || '');
  const [reality, setReality] = useState(initialGameToEdit?.whatReallyHappened || '');
  const [author, setAuthor] = useState(initialGameToEdit?.author || 'Anonymous');
  const [pillar, setPillar] = useState(themeKey || 'Relationships');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GameSpec | null>(initialGameToEdit || null);

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
      if (!response.ok || !data.gameSpec) {
        throw new Error(data.error || 'Vivi не удалось построить мир для этой ситуации.');
      }

      setGenerated(data.gameSpec);
      onSaveGame(data.gameSpec);
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
          initialGameToEdit={generated || initialGameToEdit}
          onSaveGame={onSaveGame}
          onPlayGame={onPlayGame}
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
        <span className="vivi-eyebrow">СОЗДАТЬ ИНТЕРАКТИВНЫЙ ПОСТ · 2D ДИОРАМА</span>
        <h1>
          Что произошло<br />
          <em>с вами?</em>
        </h1>
        <p>
          Опишите ситуацию своими словами. Мы превратим ее в маленький осязаемый мир, в который сможет войти любой человек и сделать выбор до того, как узнает правду.
        </p>
      </div>

      <div className="vivi-create-grid">
        <section className="vivi-create-form">
          <div className="vivi-create-step">
            <span>01 / СИТУАЦИЯ И НАПРЯЖЕНИЕ</span>
            <h2>Что произошло?</h2>
            <p>Опишите место, присутствующих, напряжение и решающий момент, когда нужно было сделать физический шаг.</p>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={6}
              placeholder="Я сидел в переговорной, когда коллега показал директору слайд, который подготовил я…"
            />
          </div>

          <div className="vivi-create-step">
            <span>02 / РАЗВЯЗКА (ПОСЛЕ ВЫБОРА)</span>
            <h2>Что вы сделали в реальности?</h2>
            <p>Эту часть увидят только те, кто совершил выбор в вашей диораме.</p>
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

          {generated && (
            <div className="vivi-create-result">
              <span className="vivi-eyebrow">МИР ГОТОВ · ГОТОВ К ИССЛЕДОВАНИЮ</span>
              <h3>{generated.title}</h3>
              <p>{generated.synopsis}</p>
              <button
                className="vivi-button mt-3 text-xs py-2 px-4"
                onClick={() => onPlayGame(generated)}
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
              Где вы были? Что изменилось? Что заставило вас сомневаться? Движок Vivi сам создаст интерактивную сцену и точки физического взаимодействия.
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
