import { Game } from './game/Game';

const app = document.getElementById('app')!;
const game = new Game(app);
void game.init();

// iOS のダブルタップ拡大とピンチを抑止
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
