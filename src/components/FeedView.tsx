import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Compass,
  Play,
  Clock,
  Heart,
  MessageCircle,
  Eye,
  PlusCircle,
  Upload,
  Download,
  BookOpen,
  Filter,
} from 'lucide-react';
import { GameSpec } from '../types/gameSpec';
import { sounds } from '../utils/soundEffects';

interface FeedViewProps {
  games: GameSpec[];
  onPlayGame: (game: GameSpec) => void;
  onEditGame: (game: GameSpec) => void;
  onImportGame: (game: GameSpec) => void;
  onCreateNew: () => void;
}

const HUMAN_CATEGORIES = [
  'Все',
  'Воспоминания',
  'Дружба',
  'Отношения',
  'Стартапы',
  'Работа',
  'Семья',
  'Сны',
  'Что бы ты сделал?',
  'Исповеди',
];

export const FeedView: React.FC<FeedViewProps> = ({
  games,
  onPlayGame,
  onEditGame,
  onImportGame,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Top featured memory
  const featuredGame = useMemo(() => {
    return games.find((g) => g.id === 'last-walk-sunset') || games[0] || null;
  }, [games]);

  // Filtered stories
  const filteredGames = useMemo(() => {
    let result = [...games];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.synopsis.toLowerCase().includes(q) ||
          g.author.toLowerCase().includes(q) ||
          (g.tags && g.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'Все') {
      result = result.filter(
        (g) =>
          g.genre.toLowerCase() === selectedCategory.toLowerCase() ||
          (g.tags && g.tags.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()))
      );
    }

    return result;
  }, [games, searchQuery, selectedCategory]);

  const handleExportJson = (game: GameSpec) => {
    sounds.playClick();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(game, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${game.id || 'memory'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleProcessImport = () => {
    try {
      setImportError(null);
      const parsed = JSON.parse(importJsonText);
      if (!parsed.title || !parsed.nodes || !parsed.startNodeId) {
        throw new Error('Некорректная структура истории. Требуются title, startNodeId и nodes.');
      }
      if (!parsed.id) parsed.id = 'imported_' + Date.now();
      if (!parsed.metrics) parsed.metrics = { plays: 0, likes: 0, rating: 5, completions: 0 };
      onImportGame(parsed);
      setIsImportModalOpen(false);
      setImportJsonText('');
      sounds.playHeal();
    } catch (err: any) {
      setImportError(err.message || 'Ошибка парсинга JSON.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero: "A Social Network of Walkable Memories" */}
      {featuredGame && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-900/30 bg-slate-900/60 shadow-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[2px] transform scale-105"
            style={{
              backgroundImage: `url(${featuredGame.bannerImage || featuredGame.coverImage})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Живое воспоминание
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300 font-medium">{featuredGame.genre}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {featuredGame.estimatedPlaytime}
                </span>
              </div>

              <h1 className="font-cinzel text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                {featuredGame.title}
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-story max-w-xl">
                {featuredGame.synopsis || featuredGame.description}
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Автор: <strong className="text-slate-200">{featuredGame.author}</strong></span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    sounds.playChoice();
                    onPlayGame(featuredGame);
                  }}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Войти в воспоминание</span>
                </button>

                <button
                  onClick={() => {
                    sounds.playClick();
                    onEditGame(featuredGame);
                  }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 text-xs font-medium transition-colors"
                >
                  <span>Открыть в студии</span>
                </button>
              </div>
            </div>

            {/* Quick Experience Badge */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 backdrop-blur-md space-y-3 min-w-[220px]">
              <div className="text-[11px] font-code uppercase tracking-wider text-amber-400 font-bold">
                Что внутри:
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✦</span>
                  <span>Ходящий персонаж (WASD)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✦</span>
                  <span>Интерактивные предметы памяти</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✦</span>
                  <span>Разговор с другом детства</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✦</span>
                  <span>Как было на самом деле</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Discovery, Search & Category Filters */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по историям, авторам, чувствам..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 transition-all font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                setIsImportModalOpen(true);
              }}
              title="Импорт JSON"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Импорт</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onCreateNew();
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide transition-colors shadow-md shadow-amber-500/10"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Рассказать историю</span>
            </button>
          </div>
        </div>

        {/* Human Story Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {HUMAN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                sounds.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:bg-slate-800/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Memory Feed Grid */}
      <section className="space-y-4">
        <h2 className="font-cinzel text-lg font-bold text-slate-100 flex items-center gap-2">
          <span>Лента воспоминаний</span>
          <span className="text-xs font-sans font-normal text-slate-500">
            ({filteredGames.length})
          </span>
        </h2>

        {filteredGames.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 space-y-3">
            <Compass className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="font-cinzel text-base text-slate-300">Ничего не найдено</h3>
            <p className="text-slate-500 text-xs">
              Попробуйте сбросить фильтры или расскажите свою первую историю!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => {
              const startNode = game.nodes[game.startNodeId];
              const memoryCount = startNode?.worldConfig?.objects?.length || 2;
              const hasTruth = !!game.whatReallyHappened;

              return (
                <div
                  key={game.id}
                  className="group relative flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/70 hover:border-amber-500/40 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-slate-950/70"
                >
                  {/* Cover Art */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                    <img
                      src={game.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'}
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
                        {game.genre}
                      </span>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-md backdrop-blur-xs font-sans">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {game.estimatedPlaytime}
                      </span>
                      {hasTruth && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] font-medium backdrop-blur-xs">
                          Есть реальный финал
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="font-cinzel text-lg font-bold text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-1">
                        {game.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-sans">От: {game.author}</p>
                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-story pt-1">
                        {game.synopsis || game.description}
                      </p>
                    </div>

                    {/* Interactive Walkable Specs */}
                    <div className="py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>{memoryCount} предметов памяти</span>
                      </span>
                      <span className="text-slate-300 font-medium">2D Прогулка</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          sounds.playChoice();
                          onPlayGame(game);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wider transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>ВОЙТИ В МИР</span>
                      </button>

                      <button
                        onClick={() => handleExportJson(game)}
                        title="Скачать JSON"
                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Импортировать историю (JSON)</span>
            </h3>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Вставьте JSON истории..."
              rows={8}
              className="w-full p-3 font-code text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
            />

            {importError && (
              <p className="text-xs text-rose-400">{importError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={handleProcessImport}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Загрузить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
