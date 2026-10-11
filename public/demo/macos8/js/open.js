import { get, resolve } from './fs.js';
import { launch } from './launch.js';
import { dialog } from './dialog.js';
import { play } from './audio.js';

export async function openNode(id) {
  let node = get(id);
  if (!node) return;
  if (node.kind === 'alias') {
    const target = resolve(node);
    if (!target) {
      play('alert');
      await dialog({
        message: `The original item for “${node.name}” can’t be found.`,
        buttons: [{ id: 'ok', label: 'OK', default: true }],
      });
      return;
    }
    node = target;
  }
  if (node.kind === 'volume') {
    launch('finder', { folderId: 'hd' });
    return;
  }
  if (node.kind === 'folder') {
    launch('finder', { folderId: node.id });
    return;
  }
  if (node.kind === 'app') {
    launch(node.app);
    return;
  }
  if (node.kind === 'extension') {
    play('alert');
    await dialog({
      message: `“${node.name}” is already running.`,
      buttons: [{ id: 'ok', label: 'OK', default: true }],
    });
    return;
  }
  if (node.kind === 'paint') {
    launch('paint', { fileId: node.id });
    return;
  }
  launch('simpletext', { fileId: node.id });
}
