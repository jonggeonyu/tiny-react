import { FunctionComponent } from '../core/FunctionComponent.js';
import { Game } from './Game.js';
import { createInspector } from './inspector.js';

const inspector = createInspector(document.querySelector('#inspector-body'));
const game = new FunctionComponent(Game, document.querySelector('#game'), {
  onCommit: (changes) => inspector.record(changes, game.hooks),
});

game.mount();
