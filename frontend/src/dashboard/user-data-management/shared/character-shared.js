import { app } from '../../shared.js';

const { state } = app;

app.getCharacterNameByCharacterId = (characterId) => {
  if (characterId === null || characterId === undefined || Number(characterId) === 0) {
    return '--';
  }

  const name = state.characterLogNameMap?.[characterId];
  return typeof name === 'string' && name.trim() ? name : '--';
};

app.getCharacterIconByCharacterId = (characterId) => {
  if (characterId === null || characterId === undefined || Number(characterId) === 0) {
    return '';
  }

  const url = state.characterHeadIconUrlMap?.[characterId];
  return typeof url === 'string' ? url : '';
};
