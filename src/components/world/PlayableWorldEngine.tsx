import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GameChoice,
  GameNode,
  GameSpec,
} from '../../types/gameSpec';
import {
  CharacterDirection,
  WorldNPC,
  WorldObject,
  WorldSceneConfig,
} from '../../types/worldTypes';
import { CharacterSprite } from './CharacterSprite';
import { WorldObjectSprite } from './WorldObjectSprite';
import { WorldEnvironmentBackdrop } from './WorldEnvironmentBackdrop';
import { MobileVirtualJoystick } from './MobileVirtualJoystick';
import { sounds } from '../../utils/soundEffects';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  History,
  RotateCcw,
  Sparkles,
  Trophy,
  Share2,
  ChevronRight,
  MessageCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface PlayableWorldEngineProps {
  gameSpec: GameSpec;
  onExit: () => void;
  onForkInStudio: (spec: GameSpec) => void;
}

export const PlayableWorldEngine: React.FC<PlayableWorldEngineProps> = ({
  gameSpec,
  onExit,
  onForkInStudio,
}) => {
  // Current active story node
  const [currentNodeId, setCurrentNodeId] = useState<string>(gameSpec.startNodeId);
  const currentNode: GameNode = gameSpec.nodes[currentNodeId] || {
    id: currentNodeId,
    title: 'Unknown Scene',
    narrative: '',
    choices: [],
  };

  // Derive or fallback worldConfig for this node
  const worldConfig: WorldSceneConfig = useMemo(() => {
    if (currentNode.worldConfig) {
      return currentNode.worldConfig;
    }

    // Smart fallback world templates based on genre or title
    const isOffice =
      gameSpec.title.toLowerCase().includes('шанс') ||
      gameSpec.title.toLowerCase().includes('office') ||
      currentNode.title.toLowerCase().includes('офис');

    const isCity =
      gameSpec.genre === 'Cyberpunk' ||
      gameSpec.title.toLowerCase().includes('neon') ||
      currentNode.title.toLowerCase().includes('улиц');

    const template = isOffice ? 'office_night' : isCity ? 'city_evening' : 'village_sunset';

    return {
      id: currentNode.id,
      template,
      title: currentNode.title,
      width: 1000,
      height: 600,
      playerSpawn: { x: 180, y: 380 },
      npcs: [],
      objects: [
        {
          id: 'obj_mem_1',
          type: isOffice ? 'laptop' : 'bench',
          name: isOffice ? 'Рабочий ноутбук' : 'Старая скамейка',
          x: 420,
          y: 360,
          interactive: true,
          interactionPrompt: 'Вспомнить',
          memoryText: 'Здесь проходили часы тихих размышлений.',
        },
      ],
    };
  }, [currentNode, gameSpec]);

  // Player continuous physics / position
  const [playerPos, setPlayerPos] = useState<{ x: number; y: number }>(() => ({
    x: worldConfig.playerSpawn?.x || 180,
    y: worldConfig.playerSpawn?.y || 380,
  }));
  const [playerDirection, setPlayerDirection] = useState<CharacterDirection>('down');
  const [isMoving, setIsMoving] = useState<boolean>(false);

  // Active key map for smooth WASD / Arrow movement
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileMoveDir = useRef<CharacterDirection | null>(null);

  // Interaction State
  const [discoveredMemories, setDiscoveredMemories] = useState<string[]>([]);
  const [activeMemoryPopup, setActiveMemoryPopup] = useState<string | null>(null);
  const [activeDialogueNpc, setActiveDialogueNpc] = useState<WorldNPC | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState<number>(0);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState<boolean>(false);
  const [historyTranscript, setHistoryTranscript] = useState<
    Array<{ nodeTitle: string; choiceText?: string; timestamp: number }>
  >(() => [
    { nodeTitle: currentNode.title, timestamp: Date.now() },
  ]);

  // Viewport & Camera follows player
  const viewportRef = useRef<HTMLDivElement>(null);
  const [cameraOffset, setCameraOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset player spawn on scene transition
  useEffect(() => {
    setPlayerPos({
      x: worldConfig.playerSpawn?.x || 180,
      y: worldConfig.playerSpawn?.y || 380,
    });
    setPlayerDirection('down');
    setActiveMemoryPopup(null);
    setActiveDialogueNpc(null);
    setDialogueIndex(0);
    setIsChoiceModalOpen(false);

    // Play ambient audio
    if (worldConfig.ambient === 'night_hum') {
      sounds.playAmbient('space_void');
    } else if (worldConfig.ambient === 'city_evening') {
      sounds.playAmbient('cyberpunk_drone');
    } else {
      sounds.playAmbient('dungeon');
    }

    return () => {
      sounds.stopAmbient();
    };
  }, [currentNodeId, worldConfig]);

  // Movement Gameloop (60fps animation frame)
  useEffect(() => {
    let animId: number;
    const moveSpeed = 3.6;

    const gameLoop = () => {
      let dx = 0;
      let dy = 0;

      const keys = keysPressed.current;
      const mDir = mobileMoveDir.current;

      if (keys['w'] || keys['W'] || keys['ArrowUp'] || mDir === 'up') dy -= 1;
      if (keys['s'] || keys['S'] || keys['ArrowDown'] || mDir === 'down') dy += 1;
      if (keys['a'] || keys['A'] || keys['ArrowLeft'] || mDir === 'left') dx -= 1;
      if (keys['d'] || keys['D'] || keys['ArrowRight'] || mDir === 'right') dx += 1;

      if (dx !== 0 && dy !== 0) {
        // Normalize diagonal
        dx *= 0.7071;
        dy *= 0.7071;
      }

      const moving = dx !== 0 || dy !== 0;
      setIsMoving(moving);

      if (moving) {
        if (Math.abs(dx) > Math.abs(dy)) {
          setPlayerDirection(dx > 0 ? 'right' : 'left');
        } else {
          setPlayerDirection(dy > 0 ? 'down' : 'up');
        }

        setPlayerPos((prev) => {
          // Boundary checks
          const minX = 40;
          const maxX = worldConfig.width - 40;
          const minY = worldConfig.height * 0.42; // walkable horizon line
          const maxY = worldConfig.height - 30;

          const nextX = Math.min(maxX, Math.max(minX, prev.x + dx * moveSpeed));
          const nextY = Math.min(maxY, Math.max(minY, prev.y + dy * moveSpeed));
          return { x: nextX, y: nextY };
        });
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [worldConfig.width, worldConfig.height]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;

      // 'E' or Space to interact with nearest target
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        triggerNearestInteraction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playerPos, worldConfig, activeDialogueNpc, dialogueIndex]);

  // Camera smooth follow calculation
  useEffect(() => {
    if (!viewportRef.current) return;
    const viewWidth = viewportRef.current.clientWidth;
    const viewHeight = viewportRef.current.clientHeight;

    const targetX = viewWidth / 2 - playerPos.x;
    const targetY = viewHeight / 2 - playerPos.y;

    // Clamp camera within map bounds
    const minCamX = -(worldConfig.width - viewWidth);
    const minCamY = -(worldConfig.height - viewHeight);

    const clampedX = Math.min(0, Math.max(minCamX, targetX));
    const clampedY = Math.min(0, Math.max(minCamY, targetY));

    setCameraOffset({ x: clampedX, y: clampedY });
  }, [playerPos, worldConfig.width, worldConfig.height]);

  // Compute nearby NPC and nearby Object
  const nearbyNPC: WorldNPC | null = useMemo(() => {
    for (const npc of worldConfig.npcs || []) {
      const dist = Math.hypot(npc.x - playerPos.x, npc.y - playerPos.y);
      if (dist <= (npc.interactionRadius || 75)) {
        return npc;
      }
    }
    return null;
  }, [playerPos, worldConfig.npcs]);

  const nearbyObject: WorldObject | null = useMemo(() => {
    for (const obj of worldConfig.objects || []) {
      const dist = Math.hypot(obj.x - playerPos.x, obj.y - playerPos.y);
      if (dist <= 65) {
        return obj;
      }
    }
    return null;
  }, [playerPos, worldConfig.objects]);

  // Trigger Interaction logic
  const triggerNearestInteraction = () => {
    // 1. NPC interaction takes precedence
    if (nearbyNPC) {
      sounds.playClick();
      if (activeDialogueNpc) {
        // Advance dialogue
        const total = activeDialogueNpc.dialogue?.length || 0;
        if (dialogueIndex + 1 < total) {
          setDialogueIndex((prev) => prev + 1);
        } else {
          // Finished dialogue -> if leads to choice, open choice panel
          setActiveDialogueNpc(null);
          setDialogueIndex(0);
          if (activeDialogueNpc.leadsToChoice || (currentNode.choices && currentNode.choices.length > 0)) {
            setIsChoiceModalOpen(true);
          }
        }
      } else {
        // Start dialogue
        setActiveDialogueNpc(nearbyNPC);
        setDialogueIndex(0);
      }
      return;
    }

    // 2. Object Memory Inspection
    if (nearbyObject && nearbyObject.interactive) {
      sounds.playClick();
      setActiveMemoryPopup(nearbyObject.memoryText || nearbyObject.name);
      if (!discoveredMemories.includes(nearbyObject.id)) {
        setDiscoveredMemories((prev) => [...prev, nearbyObject.id]);
        sounds.playHeal();
      }
      return;
    }

    // 3. If in memory popup, close it
    if (activeMemoryPopup) {
      setActiveMemoryPopup(null);
    }
  };

  // Choice Selection
  const handleSelectChoice = (choice: GameChoice) => {
    sounds.playChoice();
    const nextNode = gameSpec.nodes[choice.nextNodeId];
    if (nextNode) {
      setHistoryTranscript((prev) => [
        ...prev,
        { nodeTitle: nextNode.title, choiceText: choice.text, timestamp: Date.now() },
      ]);
      setCurrentNodeId(choice.nextNodeId);
      setIsChoiceModalOpen(false);
    }
  };

  const handleRestart = () => {
    sounds.playClick();
    setCurrentNodeId(gameSpec.startNodeId);
    setHistoryTranscript([{ nodeTitle: gameSpec.nodes[gameSpec.startNodeId]?.title || 'Начало', timestamp: Date.now() }]);
    setDiscoveredMemories([]);
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden flex flex-col justify-between select-none">
      {/* Top Atmosphere & Memory Header Bar */}
      <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 pointer-events-none flex items-start justify-between">
        {/* Story Title & Current Scene */}
        <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-xl bg-slate-950/75 border border-slate-800/80 backdrop-blur-md shadow-lg">
          <button
            onClick={() => {
              sounds.playClick();
              onExit();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title="Назад к историям"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="font-cinzel text-xs font-bold text-slate-100 block leading-tight">
              {gameSpec.title}
            </span>
            <span className="text-[10px] text-amber-400 font-code block">
              {worldConfig.title}
            </span>
          </div>
        </div>

        {/* Discovery Counter Badge & Reset */}
        <div className="pointer-events-auto flex items-center gap-2">
          {worldConfig.objects && worldConfig.objects.length > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800/80 backdrop-blur-md text-[11px] font-code text-slate-300 flex items-center gap-1.5 shadow-lg">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Воспоминания: {discoveredMemories.length} / {worldConfig.objects.length}
              </span>
            </div>
          )}

          <button
            onClick={handleRestart}
            className="p-2 rounded-xl bg-slate-950/75 border border-slate-800/80 text-slate-400 hover:text-rose-300 backdrop-blur-md shadow-lg"
            title="Начать сначала"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 2D World Viewport */}
      <div
        ref={viewportRef}
        className="relative w-full h-full overflow-hidden cursor-crosshair"
      >
        {/* World Camera Container */}
        <div
          className="absolute transition-transform duration-75 ease-out"
          style={{
            width: `${worldConfig.width}px`,
            height: `${worldConfig.height}px`,
            transform: `translate3d(${cameraOffset.x}px, ${cameraOffset.y}px, 0)`,
          }}
        >
          {/* 1. Backdrop Environment Layer */}
          <WorldEnvironmentBackdrop
            template={worldConfig.template}
            width={worldConfig.width}
            height={worldConfig.height}
          />

          {/* 2. Props & Objects (Sorted with Depth Y) */}
          {worldConfig.objects?.map((obj) => (
            <div
              key={obj.id}
              onClick={() => {
                setPlayerPos({ x: obj.x - 20, y: obj.y + 15 });
                setTimeout(triggerNearestInteraction, 200);
              }}
              className="absolute transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-105"
              style={{
                left: `${obj.x}px`,
                top: `${obj.y}px`,
                zIndex: Math.floor(obj.y),
              }}
            >
              <WorldObjectSprite
                object={obj}
                isNearby={nearbyObject?.id === obj.id}
              />
            </div>
          ))}

          {/* 3. NPCs (Sorted with Depth Y) */}
          {worldConfig.npcs?.map((npc) => {
            const isNear = nearbyNPC?.id === npc.id;
            return (
              <div
                key={npc.id}
                onClick={() => {
                  setPlayerPos({ x: npc.x - 30, y: npc.y });
                  setTimeout(triggerNearestInteraction, 200);
                }}
                className="absolute transform -translate-x-1/2 -translate-y-full transition-transform"
                style={{
                  left: `${npc.x}px`,
                  top: `${npc.y}px`,
                  zIndex: Math.floor(npc.y),
                }}
              >
                {/* Floating NPC Indicator */}
                {isNear && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-sans font-bold shadow-lg border border-amber-300 animate-bounce flex items-center gap-1.5 whitespace-nowrap">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>[E] Поговорить</span>
                  </div>
                )}
                <CharacterSprite
                  appearance={npc.appearance}
                  direction={npc.direction || (playerPos.x < npc.x ? 'left' : 'right')}
                  name={npc.name}
                  isPlayer={false}
                />
              </div>
            );
          })}

          {/* 4. Player Character (Depth Sorted) */}
          <div
            className="absolute transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${playerPos.x}px`,
              top: `${playerPos.y}px`,
              zIndex: Math.floor(playerPos.y),
            }}
          >
            <CharacterSprite
              appearance={worldConfig.playerAppearance}
              direction={playerDirection}
              isMoving={isMoving}
              isPlayer={true}
            />
          </div>
        </div>
      </div>

      {/* Floating Memory Dialogue / Thought Overlay (Minimalist, non-blocking) */}
      {activeMemoryPopup && (
        <div className="absolute bottom-20 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-40 p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 backdrop-blur-md shadow-2xl animate-fade-in space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-code font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Воспоминание</span>
            </span>
            <button
              onClick={() => setActiveMemoryPopup(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <p className="text-sm font-story text-slate-100 leading-relaxed italic">
            "{activeMemoryPopup}"
          </p>
          <div className="text-right">
            <button
              onClick={() => setActiveMemoryPopup(null)}
              className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold"
            >
              Продолжить путь
            </button>
          </div>
        </div>
      )}

      {/* NPC Dialogue Overlay Panel */}
      {activeDialogueNpc && (
        <div className="absolute bottom-20 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-lg z-40 p-5 rounded-2xl bg-slate-950/92 border border-slate-800 backdrop-blur-md shadow-2xl animate-fade-in space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="font-cinzel text-xs font-bold text-amber-300">
              {activeDialogueNpc.name}
            </span>
            <span className="text-[10px] text-slate-500 font-code">
              {(activeDialogueNpc.dialogue?.length || 1) > 1
                ? `${dialogueIndex + 1} / ${activeDialogueNpc.dialogue?.length}`
                : ''}
            </span>
          </div>

          <p className="text-sm sm:text-base font-story text-slate-100 leading-relaxed italic">
            "{activeDialogueNpc.dialogue?.[dialogueIndex]?.text || 'Привет...'}"
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={triggerNearestInteraction}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wider transition-colors shadow-md"
            >
              {dialogueIndex + 1 < (activeDialogueNpc.dialogue?.length || 0)
                ? 'Далее →'
                : 'Ответить...'}
            </button>
          </div>
        </div>
      )}

      {/* Prompt button to make final choice if choices exist and not open */}
      {!isChoiceModalOpen && !currentNode.isEnding && currentNode.choices && currentNode.choices.length > 0 && !activeDialogueNpc && (
        <div className="absolute bottom-6 right-6 z-30 hidden sm:block">
          <button
            onClick={() => {
              sounds.playClick();
              setIsChoiceModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
          >
            <span>Сделать выбор</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Choice Decision Panel Modal */}
      {isChoiceModalOpen && !currentNode.isEnding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <span className="text-[10px] font-code uppercase tracking-wider text-amber-400 font-bold">
                Решающий момент
              </span>
              <h3 className="font-cinzel text-xl font-bold text-slate-100">
                Что ты сделаешь?
              </h3>
            </div>

            <div className="space-y-2.5">
              {currentNode.choices?.map((choice, cIdx) => (
                <button
                  key={choice.id || cIdx}
                  onClick={() => handleSelectChoice(choice)}
                  className="w-full text-left p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-850 text-slate-100 transition-all flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-1 pr-3">
                    <span className="text-sm font-bold block group-hover:text-amber-300 transition-colors">
                      {choice.text}
                    </span>
                    {choice.hint && (
                      <span className="text-xs text-slate-400 font-story italic block">
                        {choice.hint}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0" />
                </button>
              ))}
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setIsChoiceModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Вернуться к прогулке
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ending & WHAT REALLY HAPPENED Screen */}
      {currentNode.isEnding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-amber-500/40 p-6 sm:p-8 space-y-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Trophy className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-code uppercase tracking-wider text-amber-400 font-bold block">
                Финал истории
              </span>
              <h2 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-slate-100">
                {currentNode.endingTitle || currentNode.title}
              </h2>
              {currentNode.endingSummary && (
                <p className="text-sm text-slate-300 font-story leading-relaxed max-w-md mx-auto">
                  {currentNode.endingSummary}
                </p>
              )}
            </div>

            {/* WHAT REALLY HAPPENED: REAL LIFE MEMORY TRUTH */}
            {(gameSpec.whatReallyHappened || currentNode.whatReallyHappened) && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 text-left space-y-2">
                <span className="text-[11px] font-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>КАК БЫЛО НА САМОМ ДЕЛЕ (ОТ АВТОРА):</span>
                </span>
                <p className="text-sm font-story text-slate-200 leading-relaxed italic">
                  "{gameSpec.whatReallyHappened || currentNode.whatReallyHappened}"
                </p>
              </div>
            )}

            {/* Story Exploration Stats */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs">
              <div>
                <span className="text-slate-400 font-code">Воспоминаний найдено:</span>
                <p className="text-base font-bold text-slate-100">
                  {discoveredMemories.length} предметов
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-code">Твой путь:</span>
                <p className="text-base font-bold text-amber-400">
                  {historyTranscript.length} шагов
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wider transition-colors shadow-lg shadow-amber-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>ПРОЙТИ СНОВА</span>
              </button>

              <button
                onClick={() => {
                  sounds.playHeal();
                  const txt = `Я прошел историю "${gameSpec.title}" на Mythos!`;
                  navigator.clipboard.writeText(txt);
                  alert('Ссылка скопирована!');
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Поделиться</span>
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  onExit();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                В ленту историй
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Virtual Controls (Visible only on touch/mobile) */}
      <div className="sm:hidden">
        <MobileVirtualJoystick
          onMove={(dir) => {
            mobileMoveDir.current = dir;
          }}
          onInteract={triggerNearestInteraction}
          canInteract={!!nearbyNPC || !!nearbyObject}
          interactionLabel={nearbyNPC ? 'Говорить' : nearbyObject?.interactionPrompt || 'Смотреть'}
        />
      </div>
    </div>
  );
};
