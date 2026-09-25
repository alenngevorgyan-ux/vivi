import {
  ActiveGameState,
  GameChoice,
  GameNode,
  GameSpec,
  PlayHistoryStep,
} from '../types/gameSpec';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalNodes: number;
    endingCount: number;
    totalChoices: number;
    unreachableNodeIds: string[];
  };
}

export function validateGameSpec(spec: GameSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec.title || spec.title.trim() === '') {
    errors.push('GameSpec missing title.');
  }

  if (!spec.nodes || Object.keys(spec.nodes).length === 0) {
    errors.push('GameSpec contains no narrative nodes.');
    return {
      isValid: false,
      errors,
      warnings,
      stats: { totalNodes: 0, endingCount: 0, totalChoices: 0, unreachableNodeIds: [] },
    };
  }

  if (!spec.startNodeId || !spec.nodes[spec.startNodeId]) {
    errors.push(`Start node ID "${spec.startNodeId}" does not exist in nodes.`);
  }

  let totalChoices = 0;
  let endingCount = 0;
  const nodeIds = new Set(Object.keys(spec.nodes));
  const referencedNodeIds = new Set<string>();
  if (spec.startNodeId) referencedNodeIds.add(spec.startNodeId);

  for (const [id, node] of Object.entries(spec.nodes)) {
    if (node.isEnding) {
      endingCount++;
      if (!node.endingTitle) {
        warnings.push(`Ending node "${id}" is missing an endingTitle.`);
      }
    } else {
      if (!node.choices || node.choices.length === 0) {
        errors.push(`Node "${id}" (${node.title}) is not marked as an ending but has no choices.`);
      }
    }

    if (node.choices) {
      totalChoices += node.choices.length;
      for (const choice of node.choices) {
        if (!choice.text || choice.text.trim() === '') {
          errors.push(`Choice in node "${id}" has empty action text.`);
        }

        if (choice.riskOutcome) {
          const { successNodeId, failureNodeId } = choice.riskOutcome;
          if (!nodeIds.has(successNodeId)) {
            errors.push(`Choice in node "${id}" has invalid risk successNodeId "${successNodeId}".`);
          } else {
            referencedNodeIds.add(successNodeId);
          }
          if (!nodeIds.has(failureNodeId)) {
            errors.push(`Choice in node "${id}" has invalid risk failureNodeId "${failureNodeId}".`);
          } else {
            referencedNodeIds.add(failureNodeId);
          }
        } else {
          if (!nodeIds.has(choice.nextNodeId)) {
            errors.push(`Choice in node "${id}" references non-existent node "${choice.nextNodeId}".`);
          } else {
            referencedNodeIds.add(choice.nextNodeId);
          }
        }
      }
    }
  }

  if (endingCount === 0) {
    warnings.push('The story has no nodes marked as endings (isEnding: true).');
  }

  // Find unreachable nodes
  const unreachableNodeIds: string[] = [];
  for (const id of nodeIds) {
    if (!referencedNodeIds.has(id) && id !== spec.startNodeId) {
      unreachableNodeIds.push(id);
    }
  }

  if (unreachableNodeIds.length > 0) {
    warnings.push(`${unreachableNodeIds.length} node(s) cannot be reached from any choice: ${unreachableNodeIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalNodes: nodeIds.size,
      endingCount,
      totalChoices,
      unreachableNodeIds,
    },
  };
}

export function initializeGameState(spec: GameSpec): ActiveGameState {
  const initialStats: Record<string, number> = {};
  if (spec.initialState?.stats) {
    for (const [key, stat] of Object.entries(spec.initialState.stats)) {
      initialStats[key] = stat.value;
    }
  }

  const initialInventory = spec.initialState?.inventory ? [...spec.initialState.inventory] : [];
  const initialFlags = spec.initialState?.flags ? { ...spec.initialState.flags } : {};

  const startNode = spec.nodes[spec.startNodeId];

  const firstStep: PlayHistoryStep = {
    nodeId: spec.startNodeId,
    nodeTitle: startNode?.title || 'Beginning',
    timestamp: Date.now(),
    statSnapshot: { ...initialStats },
    inventorySnapshot: [...initialInventory],
  };

  return {
    spec,
    currentNodeId: spec.startNodeId,
    stats: initialStats,
    inventory: initialInventory,
    flags: initialFlags,
    history: [firstStep],
    achievementsUnlocked: [],
    isGameOver: startNode?.isEnding || false,
    endingNodeId: startNode?.isEnding ? startNode.id : undefined,
  };
}

export interface ChoiceExecutionResult {
  newState: ActiveGameState;
  notifications: {
    type: 'stat' | 'item' | 'achievement' | 'risk';
    message: string;
    positive?: boolean;
  }[];
}

export function canSelectChoice(state: ActiveGameState, choice: GameChoice): { canSelect: boolean; reason?: string } {
  const { conditions, cost } = choice;

  // Check stat costs
  if (cost) {
    const current = state.stats[cost.statKey] ?? 0;
    if (current < cost.amount) {
      return { canSelect: false, reason: `Requires at least ${cost.amount} ${cost.statKey.toUpperCase()}` };
    }
  }

  // Check required stats
  if (conditions?.requiredStats) {
    for (const [statKey, req] of Object.entries(conditions.requiredStats)) {
      const current = state.stats[statKey] ?? 0;
      if (req.min !== undefined && current < req.min) {
        return { canSelect: false, reason: `Requires ${statKey.toUpperCase()} >= ${req.min}` };
      }
      if (req.max !== undefined && current > req.max) {
        return { canSelect: false, reason: `Requires ${statKey.toUpperCase()} <= ${req.max}` };
      }
    }
  }

  // Check required items
  if (conditions?.requiredItems && conditions.requiredItems.length > 0) {
    const inventoryItemIds = new Set(state.inventory.map((item) => item.id));
    for (const itemId of conditions.requiredItems) {
      if (!inventoryItemIds.has(itemId)) {
        return { canSelect: false, reason: `Missing required item in inventory` };
      }
    }
  }

  // Check flags
  if (conditions?.requiredFlags) {
    for (const [flagKey, expectedVal] of Object.entries(conditions.requiredFlags)) {
      if (state.flags[flagKey] !== expectedVal) {
        return { canSelect: false, reason: `Prerequisite condition not met` };
      }
    }
  }

  return { canSelect: true };
}

export function executeChoice(state: ActiveGameState, choice: GameChoice): ChoiceExecutionResult {
  const notifications: ChoiceExecutionResult['notifications'] = [];

  // Clone current stats and inventory
  const nextStats = { ...state.stats };
  let nextInventory = [...state.inventory];
  const nextFlags = { ...state.flags };

  // 1. Deduct cost if applicable
  if (choice.cost) {
    const current = nextStats[choice.cost.statKey] || 0;
    nextStats[choice.cost.statKey] = Math.max(0, current - choice.cost.amount);
    notifications.push({
      type: 'stat',
      message: `-${choice.cost.amount} ${choice.cost.statKey.toUpperCase()}`,
      positive: false,
    });
  }

  // 2. Determine target node (handle risk outcome if defined)
  let targetNodeId = choice.nextNodeId;
  let lastDiceRoll = undefined;

  if (choice.riskOutcome) {
    const roll = Math.random();
    const threshold = choice.riskOutcome.chance;
    const isSuccess = roll <= threshold;
    targetNodeId = isSuccess ? choice.riskOutcome.successNodeId : choice.riskOutcome.failureNodeId;

    lastDiceRoll = {
      stat: choice.riskOutcome.rollStat || 'Luck',
      roll: Math.round(roll * 100),
      threshold: Math.round(threshold * 100),
      success: isSuccess,
    };

    notifications.push({
      type: 'risk',
      message: isSuccess
        ? `Skill Check PASSED (${Math.round(threshold * 100)}% chance)`
        : `Skill Check FAILED (${Math.round(threshold * 100)}% chance)`,
      positive: isSuccess,
    });
  }

  const nextNode: GameNode | undefined = state.spec.nodes[targetNodeId];
  if (!nextNode) {
    throw new Error(`Target node ${targetNodeId} not found in GameSpec.`);
  }

  // 3. Apply node consequences
  if (nextNode.consequences) {
    const { statChanges, inventoryAdd, inventoryRemove, flagChanges } = nextNode.consequences;

    if (statChanges) {
      for (const [statKey, delta] of Object.entries(statChanges)) {
        const cur = nextStats[statKey] || 0;
        const specStatConfig = state.spec.initialState?.stats?.[statKey];
        const minVal = specStatConfig?.min ?? 0;
        const maxVal = specStatConfig?.max ?? 99999;
        const updated = Math.min(maxVal, Math.max(minVal, cur + delta));
        nextStats[statKey] = updated;

        notifications.push({
          type: 'stat',
          message: `${delta > 0 ? '+' : ''}${delta} ${specStatConfig?.label || statKey.toUpperCase()}`,
          positive: delta > 0,
        });
      }
    }

    if (inventoryAdd && inventoryAdd.length > 0) {
      for (const newItem of inventoryAdd) {
        const existingIdx = nextInventory.findIndex((i) => i.id === newItem.id);
        if (existingIdx >= 0) {
          nextInventory[existingIdx] = {
            ...nextInventory[existingIdx],
            quantity: (nextInventory[existingIdx].quantity || 1) + (newItem.quantity || 1),
          };
        } else {
          nextInventory.push({ ...newItem, quantity: newItem.quantity || 1 });
        }
        notifications.push({
          type: 'item',
          message: `Acquired: ${newItem.name}`,
          positive: true,
        });
      }
    }

    if (inventoryRemove && inventoryRemove.length > 0) {
      for (const removeId of inventoryRemove) {
        const itemToRemove = nextInventory.find((i) => i.id === removeId);
        nextInventory = nextInventory.filter((i) => i.id !== removeId);
        if (itemToRemove) {
          notifications.push({
            type: 'item',
            message: `Lost: ${itemToRemove.name}`,
            positive: false,
          });
        }
      }
    }

    if (flagChanges) {
      Object.assign(nextFlags, flagChanges);
    }
  }

  // 4. Check achievements
  const newAchievements = [...state.achievementsUnlocked];
  if (state.spec.achievements) {
    for (const ach of state.spec.achievements) {
      if (ach.conditionNodeId === targetNodeId && !newAchievements.includes(ach.id)) {
        newAchievements.push(ach.id);
        notifications.push({
          type: 'achievement',
          message: `Achievement Unlocked: ${ach.title}`,
          positive: true,
        });
      }
    }
  }

  // 5. Append to history
  const historyStep: PlayHistoryStep = {
    nodeId: targetNodeId,
    nodeTitle: nextNode.title,
    chosenChoiceText: choice.text,
    timestamp: Date.now(),
    statSnapshot: { ...nextStats },
    inventorySnapshot: [...nextInventory],
  };

  const isEnding = !!nextNode.isEnding;

  const newState: ActiveGameState = {
    spec: state.spec,
    currentNodeId: targetNodeId,
    stats: nextStats,
    inventory: nextInventory,
    flags: nextFlags,
    history: [...state.history, historyStep],
    achievementsUnlocked: newAchievements,
    isGameOver: isEnding,
    endingNodeId: isEnding ? targetNodeId : undefined,
    lastDiceRoll,
  };

  return { newState, notifications };
}

export function rewindToStep(state: ActiveGameState, stepIndex: number): ActiveGameState {
  if (stepIndex < 0 || stepIndex >= state.history.length) {
    return state;
  }

  const targetStep = state.history[stepIndex];
  const targetNode = state.spec.nodes[targetStep.nodeId];

  return {
    ...state,
    currentNodeId: targetStep.nodeId,
    stats: { ...targetStep.statSnapshot },
    inventory: [...targetStep.inventorySnapshot],
    history: state.history.slice(0, stepIndex + 1),
    isGameOver: targetNode?.isEnding || false,
    endingNodeId: targetNode?.isEnding ? targetNode.id : undefined,
    lastDiceRoll: undefined,
  };
}
