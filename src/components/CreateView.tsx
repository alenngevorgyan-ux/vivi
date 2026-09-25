import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Play,
  Save,
  Wand2,
  Settings2,
  Code2,
  Plus,
  Trash2,
  GitBranch,
} from 'lucide-react';
import { GameSpec, GameNode, GameChoice } from '../types/gameSpec';
import { sounds } from '../utils/soundEffects';

interface CreateViewProps {
  onSaveGame: (game: GameSpec) => void;
  onPlayGame: (game: GameSpec) => void;
  initialGameToEdit?: GameSpec | null;
}

const MEMORY_INSPIRATIONS = [
  {
    title: 'Последняя прогулка',
    author: 'Алексей',
    story: 'Мой лучший школьный друг уезжал в другой город навсегда. Мы бродили по старой улице до самого заката, вспоминая детство, и не знали, как попрощаться.',
    reality: 'Я ничего не сказал, мы просто молча обнялись на остановке. Больше мы никогда не общались.',
  },
  {
    title: 'Последний шанс',
    author: 'Мария',
    story: 'Ночь в офисе стартапа. Денег осталось на неделю. Мой сооснователь сидит напротив и ждет, что мы решим: закрываться или выкатывать всё ва-банк.',
    reality: 'Мы рискнули и выкатили сырой прототип в сеть прямо под утро. Это спасло компанию.',
  },
  {
    title: 'Забытая фотография',
    author: 'Михаил',
    story: 'Я разбирал чердак дедушкиного дома в деревне перед продажей и нашел снимок 1974 года с незнакомой девушкой у старого колодца.',
    reality: 'Я так и не решился спросить у бабушки, кто это была, и увёз снимок с собой.',
  },
];

export const CreateView: React.FC<CreateViewProps> = ({
  onSaveGame,
  onPlayGame,
  initialGameToEdit,
}) => {
  // Simple Consumer Mode (Default) vs Developer Node Studio Mode
  const [mode, setMode] = useState<'consumer' | 'developer_studio'>('consumer');

  // Consumer Story Creator form
  const [storyText, setStoryText] = useState(
    initialGameToEdit ? initialGameToEdit.description : ''
  );
  const [whatReallyHappened, setWhatReallyHappened] = useState(
    initialGameToEdit?.whatReallyHappened || ''
  );
  const [authorName, setAuthorName] = useState(
    initialGameToEdit?.author || 'Аноним'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Воспоминания');

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active loaded/generated game
  const [generatedGame, setGeneratedGame] = useState<GameSpec | null>(initialGameToEdit || null);

  // Developer Studio Node Editor State (preserved for advanced editing)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    initialGameToEdit?.startNodeId || 'node_start'
  );

  const handleGenerateMemory = async () => {
    if (!storyText.trim()) return;
    try {
      sounds.playClick();
      setIsGenerating(true);
      setErrorMsg(null);
      setGenerationStep('Слушаем твою историю и воссоздаем 2D мир...');

      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: storyText,
          whatReallyHappened,
          genre: selectedCategory,
          author: authorName || 'Анонимный автор',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка при генерации мира');
      }

      setGenerationStep('Расставляем предметы памяти и диалог с персонажем...');
      const data = await response.json();

      if (data.gameSpec) {
        sounds.playHeal();
        setGeneratedGame(data.gameSpec);
        onSaveGame(data.gameSpec);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Не удалось создать мир. Попробуйте еще раз.');
      sounds.playDamage();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Studio Header & Toggle to Advanced Tools */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-slate-100">
            Расскажи свою историю
          </h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Настоящее воспоминание превратится в маленький ходящий 2D-мир, где каждый сможет пройти твой путь.
          </p>
        </div>

        {/* Developer Studio Toggle Button */}
        <button
          onClick={() => {
            sounds.playClick();
            setMode(mode === 'consumer' ? 'developer_studio' : 'consumer');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>{mode === 'consumer' ? 'Инструменты разработчика' : 'Простой режим'}</span>
        </button>
      </div>

      {/* CONSUMER STORY CREATOR (DEFAULT) */}
      {mode === 'consumer' && (
        <div className="space-y-6">
          {/* Inspiration Quick Cards */}
          <div className="space-y-2">
            <span className="text-[11px] font-code uppercase tracking-wider text-slate-400">
              Примеры живых историй:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MEMORY_INSPIRATIONS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => {
                    sounds.playClick();
                    setStoryText(item.story);
                    setWhatReallyHappened(item.reality);
                    setAuthorName(item.author);
                  }}
                  className="text-left p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-850/80 transition-all space-y-1.5 group"
                >
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 block">
                    {item.title}
                  </span>
                  <p className="text-[11px] text-slate-400 font-story line-clamp-3 leading-relaxed">
                    "{item.story}"
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Story Form */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-2xl space-y-6">
            {/* Story Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-100 flex items-center justify-between">
                <span>Что произошло? (Твое воспоминание)</span>
                <span className="text-xs text-slate-500 font-normal">
                  Опиши место, человека рядом и главное решение
                </span>
              </label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Например: Был теплый вечер августа. Мой лучший друг Дима уезжал навсегда в другой город. Мы вышли во двор на нашу старую скамейку, где провели всё детство..."
                rows={5}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-story leading-relaxed transition-all"
              />
            </div>

            {/* What Really Happened */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-100 flex items-center justify-between">
                <span>Что случилось в реальности? (Как было на самом деле)</span>
                <span className="text-[11px] text-amber-400 font-code font-normal">
                  Игрок узнает это в конце
                </span>
              </label>
              <textarea
                value={whatReallyHappened}
                onChange={(e) => setWhatReallyHappened(e.target.value)}
                placeholder="Например: В реальности я постеснялся сказать, как он мне дорог. Мы просто неловко пожали руки, он сел в автобус, и больше мы никогда не виделись..."
                rows={3}
                className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 font-story leading-relaxed transition-all"
              />
            </div>

            {/* Author & Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Категория</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 font-sans"
                >
                  <option value="Воспоминания">Воспоминания</option>
                  <option value="Дружба">Дружба</option>
                  <option value="Отношения">Отношения</option>
                  <option value="Стартапы">Стартапы</option>
                  <option value="Работа">Работа</option>
                  <option value="Семья">Семья</option>
                  <option value="Сны">Сны</option>
                  <option value="Исповеди">Исповеди</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Как тебя подписать?</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Имя или псевдоним"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Big Action Button */}
            <div className="pt-2">
              <button
                onClick={handleGenerateMemory}
                disabled={isGenerating || !storyText.trim()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-sm tracking-wide shadow-xl shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2.5 active:scale-[0.99]"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{generationStep}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>СОЗДАТЬ ИСТОРИЮ (2D МИР)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Result Preview Card */}
          {generatedGame && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-code uppercase tracking-wider text-amber-400 font-bold">
                  Мир готов к исследованию:
                </span>
                <h3 className="font-cinzel text-xl font-bold text-slate-100">
                  {generatedGame.title}
                </h3>
                <p className="text-xs text-slate-400 font-story line-clamp-2">
                  {generatedGame.synopsis || generatedGame.description}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    sounds.playChoice();
                    onPlayGame(generatedGame);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wider transition-colors shadow-lg shadow-amber-500/20"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>ВОЙТИ И ПРОЙТИ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEVELOPER NODE STUDIO (HOUSED CLEANLY BEHIND SECONDARY CONTROL) */}
      {mode === 'developer_studio' && generatedGame && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-400" />
              <span>Редактор узлов и 2D конфигурации ({Object.keys(generatedGame.nodes).length})</span>
            </h3>
            <button
              onClick={() => {
                sounds.playHeal();
                onSaveGame(generatedGame);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Сохранить</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(generatedGame.nodes).map((node) => (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  selectedNodeId === node.id
                    ? 'bg-amber-500/15 border-amber-500/60'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <span className="text-xs font-bold block truncate">{node.title}</span>
                <span className="text-[10px] font-code text-slate-500 block">
                  #{node.id} {node.isEnding ? '(Финал)' : ''}
                </span>
              </button>
            ))}
          </div>

          {/* Node Editor Form */}
          {generatedGame.nodes[selectedNodeId] && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 font-code uppercase">Заголовок сцены</label>
                <input
                  type="text"
                  value={generatedGame.nodes[selectedNodeId].title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setGeneratedGame((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        nodes: {
                          ...prev.nodes,
                          [selectedNodeId]: { ...prev.nodes[selectedNodeId], title },
                        },
                      };
                    });
                  }}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-code uppercase">Текст сцены</label>
                <textarea
                  value={generatedGame.nodes[selectedNodeId].narrative}
                  onChange={(e) => {
                    const narrative = e.target.value;
                    setGeneratedGame((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        nodes: {
                          ...prev.nodes,
                          [selectedNodeId]: { ...prev.nodes[selectedNodeId], narrative },
                        },
                      };
                    });
                  }}
                  rows={4}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-story"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
