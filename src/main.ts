// ============ Entry point CASH OR DUEL ============
import './styles/main.css';
import { GameApp } from './app/GameApp';

const container = document.getElementById('scene-container');
if (!container) throw new Error('#scene-container tidak ditemukan');

const game = new GameApp(container);

// ekspos untuk debugging di console browser
(window as unknown as { cashOrDuel: GameApp }).cashOrDuel = game;

