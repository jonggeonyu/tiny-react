import { FunctionComponent } from '../core/FunctionComponent.js';
import { Game } from './Game.js';

new FunctionComponent(Game, document.querySelector('#game')).mount();
