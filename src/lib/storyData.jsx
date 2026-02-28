// ============================================
// STORY DATA STRUCTURES
// ============================================

export const createScene = (id, title = 'New Scene', content = '') => ({
  id,
  title,
  content,
  choices: [],
  position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
  isStart: false,
  isEnding: false
});

export const createChoice = (id, text = 'Choice text...', targetSceneId = null) => ({
  id,
  text,
  targetSceneId
});

// ============================================
// INK CODE GENERATOR
// ============================================

export const generateInkCode = (scenes) => {
  let ink = '';

  const sortedScenes = [...scenes].sort((a, b) => {
    if (a.isStart) return -1;
    if (b.isStart) return 1;
    return 0;
  });

  sortedScenes.forEach(scene => {
    const knotName = scene.isStart ? 'start' : `scene_${scene.id}`;
    ink += `=== ${knotName} ===\n`;

    if (scene.content) {
      ink += `${scene.content}\n\n`;
    }

    if (scene.isEnding) {
      ink += '-> END\n';
    } else if (scene.choices.length > 0) {
      scene.choices.forEach(choice => {
        const target = choice.targetSceneId
          ? (scenes.find(s => s.id === choice.targetSceneId)?.isStart
              ? 'start'
              : `scene_${choice.targetSceneId}`)
          : 'END';
        ink += `* [${choice.text}] -> ${target}\n`;
      });
    } else {
      ink += '-> END\n';
    }

    ink += '\n';
  });

  return ink;
};

// ============================================
// STORY RUNTIME (for preview)
// ============================================

export class StoryEngine {
  constructor(scenes) {
    this.scenes = scenes;
    this.currentScene = scenes.find(s => s.isStart) || scenes[0];
    this.history = [];
    this.visitedChoices = new Set();
  }

  getCurrentState() {
    if (!this.currentScene) {
      return { content: 'No starting scene defined.', choices: [], isEnd: true };
    }

    return {
      title: this.currentScene.title,
      content: this.currentScene.content,
      choices: this.currentScene.isEnding ? [] : this.currentScene.choices.filter(c => c.targetSceneId),
      isEnd: this.currentScene.isEnding || this.currentScene.choices.filter(c => c.targetSceneId).length === 0
    };
  }

  makeChoice(choiceId) {
    const choice = this.currentScene.choices.find(c => c.id === choiceId);
    if (!choice || !choice.targetSceneId) return this.getCurrentState();

    this.history.push({
      scene: this.currentScene,
      choice: choice
    });

    this.currentScene = this.scenes.find(s => s.id === choice.targetSceneId);
    return this.getCurrentState();
  }

  goBack() {
    if (this.history.length === 0) return this.getCurrentState();
    const prev = this.history.pop();
    this.currentScene = prev.scene;
    return this.getCurrentState();
  }

  restart() {
    this.currentScene = this.scenes.find(s => s.isStart) || this.scenes[0];
    this.history = [];
    return this.getCurrentState();
  }
}

// ============================================
// ICONS
// ============================================

import React from 'react';

export const Icons = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Play: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  ),
  Code: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
    </svg>
  ),
  Download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Trash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Link: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Flag: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  End: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
    </svg>
  ),
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  ),
  Restart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
  Share: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Grid: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Save: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Duplicate: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/>
    </svg>
  ),
  Map: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/>
      <line x1="8.5" y1="7.5" x2="10" y2="16"/><line x1="15.5" y1="7.5" x2="14" y2="16"/>
    </svg>
  ),
  Undo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
  Redo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
    </svg>
  ),
};

// ============================================
// SAMPLE STORY (with bug fixes applied)
// ============================================

export const getSampleStory = () => ({
  title: 'My Branching Story',
  scenes: [
    {
      ...createScene('1', 'Opening', 'You find yourself at a crossroads. The path ahead splits in two directions—one leads into a dark forest, the other toward a distant village with smoke rising from its chimneys.'),
      isStart: true,
      choices: [
        createChoice('c1', 'Enter the forest', '2'),
        createChoice('c2', 'Head to the village', '3')
      ]
    },
    {
      ...createScene('2', 'The Dark Forest'),
      content: 'The trees grow thick around you, blocking out most of the sunlight. Strange sounds echo in the distance. You notice a faint trail leading deeper into the woods, and what looks like an old cabin nearby.',
      choices: [
        createChoice('c3', 'Follow the trail', '4'),
        createChoice('c4', 'Investigate the cabin', '5')
      ]
    },
    {
      ...createScene('3', 'The Village'),
      content: 'The village is small but lively. Villagers go about their daily tasks, casting curious glances your way. A tavern sign creaks in the wind, and you notice an old woman watching you intently from a market stall.',
      choices: [
        createChoice('c5', 'Visit the tavern', '6'),
        createChoice('c6', 'Speak to the old woman', '7')
      ]
    },
    {
      ...createScene('4', 'Deep in the Woods'),
      content: 'The trail ends at a clearing where ancient stones stand in a circle. You\'ve discovered the Forest Shrine—a place of ancient power. Your journey has led you to something extraordinary.\n\nCongratulations, you\'ve found one of the endings!',
      isEnding: true,
    },
    {
      ...createScene('5', 'The Cabin'),
      content: 'The cabin is abandoned but recently used. Inside, you find maps, strange symbols drawn on the walls, and a journal written in a language you don\'t recognize. As you piece together the clues, you realize this was a wizard\'s hideaway—and the secrets within could change everything.\n\nYou\'ve reached an ending.',
      isEnding: true,
    },
    {
      ...createScene('6', 'The Tavern'),
      content: 'The tavern is warm and filled with the smell of cooking food. The barkeeper nods at you, and you notice a group of adventurers huddled in the corner, speaking in hushed tones. You join them and hear tales of distant lands and hidden treasures. Perhaps your next adventure starts here.\n\nYou\'ve reached an ending.',
      isEnding: true,
    },
    {
      ...createScene('7', 'The Fortune Teller'),
      content: '"I\'ve been expecting you," the old woman says with a knowing smile. She takes your hand and traces the lines on your palm. "Your story has many possible endings. You\'ve found your way to one of them."\n\nThe End.',
      isEnding: true,
    }
  ]
});
